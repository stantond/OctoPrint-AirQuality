import os
import re
import sys
import glob
import json
import threading
import serial
from serial.tools import list_ports
import plantower, time
from pms.sensor import SensorReader

class SensorsManager():
    def __init__(self, plugin, database_manager):
        self._logger = plugin._logger
        self._logger.info("Starting sensor manager...")
        self._identifier = plugin._identifier
        self._plugin_manager = plugin._plugin_manager
        self._printer = plugin._printer
        self._settings = plugin._settings
        self.database_manager = database_manager

        # Device Management Variables
        self.printer_port = ""
        self.devices = []
        self.serial_ports = []
        self.serial_port_details = {}

        # Read Thread Variables
        self.readThread = None
        self.readThreadActive = False

        # Start-Up Functions
        self.update_serial_ports()
        self.initialise_sensors()
        # self.start_sensors_read_thread() # @TODO work out when to start the thread for the first time after startup

    def initialise_sensors(self):
        """Load stored device details from the database into a dictionary and make them usable"""
        self.devices = self.database_manager.get_devices()
        self.update_devices_additional_attributes()

    def update_devices_additional_attributes(self):  # @TODO this also needs to be run when sensors are added/port settings are changed
        """Add or update the required Python attributes (not stored in the database) for each device in the dictionary."""
        for device in self.devices:
            self.update_device_reader(device)
            self.update_device_availability(device)

    def update_device_reader(self, device):
        """
        Create a `reader` instance for the given device, as long as a port is defined.
        Note: The `reader` will not work when the device is physically unavailable.
        """
        device["reader"] = None
        if device["port"] != None:
            device["reader"] = SensorReader(device["model"], device["port"], 0)

    def update_device_availability(self, device):
        """
        Checks if the `port` matches an available serial port and updates the `is_available` attribute.
        """
        device["is_available"] = False
        if device["port"] != None:
            if device["port"] in self.serial_port_details.keys():
                device["is_available"] = True

    def refresh_available_serial_ports(self):
        """
        Update the list of available serial ports and update device availability if changed
        """
        serial_port_devices_changed = self.update_serial_ports()
        if serial_port_devices_changed == True:
            self.stop_sensors_read_thread() # @TODO Does the thread really need to be stopped and restarted, or can availability check go inside the thread?
            for device in self.devices:
                self.update_device_availability(device)
            pass
        self.start_sensors_read_thread() # @TODO Does the thread really need to be stopped and restarted, or can availability check go inside the thread?

    def sensors_read_thread(self):
        """Read the sensors and store the results until told to stop."""
        self._logger.info("Starting Sensor Read Loop")
        while self.readThreadActive is True:
            self._logger.info("Start of Read loop")
            for device in self.devices:
                # @TODO Stop the thread with an error if there are no more devices where `is_available` = True
                try:
                    # @TODO Make sure the device is `is_available` before trying to read it
                    with device["reader"] as reader:
                        print("trying to read")
                        # @todo handle octoprint stealing the serial port until it figures out it's wrong
                        # @todo handle when reading.thing doesn't exist
                        # @todo handle all the other possible readings
                        self.database_manager.insert_reading(device["id"], device["location_id"], next(reader()))
                except serial.SerialException:
                    self._logger.error("Error reading from sensor")
                    self.stop_sensors_read_thread()
                    # @TODO safely remove the sensor by updating it's availability
            time.sleep(5)
        self._logger.info("Sensors Read Thread Stopped")

    def start_sensors_read_thread(self):
        """Start the sensor read thread."""
        if self.readThread is None:
            # @TODO fail if there are no sensors to be read
            self.set_sensors_read_thread_active_status(True)
            self.readThread = threading.Thread(
                target=self.sensors_read_thread,
                # args=(self.sensors,)
            )
            self.readThread.daemon = True
            self.readThread.start()

    def stop_sensors_read_thread(self):
        """Stop the sensor read thread."""
        self.set_sensors_read_thread_active_status(False)
        if self.readThread and threading.current_thread() != self.readThread:
            self.readThread.join()
        self.readThread = None

    def set_sensors_read_thread_active_status(self, status):
        """Set the Active status of the Read Thread to True or False, and message the frontend to update the UI."""
        self.readThreadActive = status
        self._logger.info("Sensor Read Thread status set to " + str(self.readThreadActive))
        self._plugin_manager.send_plugin_message(self._identifier, dict(sensors_read_thread_active_status=str(self.readThreadActive).lower()))

    # See https://pyserial.readthedocs.io/en/latest/tools.html#serial.tools.list_ports.ListPortInfo
    def update_serial_ports(self):
        """
        Update the list of available serial ports.
        Returns `True` if there have been any changes to the available ports since last update, `False` if not.
        """
        self.serial_port_details = {}
        self._logger.info("Building list of available serial devices...")
        self.serial_ports = list(list_ports.comports())
        self.identify_printer_port()
        for i in self.serial_ports:
            # Ignore the printer serial port by removing it from the list.
            if i.device == self.printer_port:
                self.serial_ports.remove(i)
        if len(self.serial_ports) == 0:
            self._logger.info("No serial ports available")
        else:
            # Build dictionary of serial ports with `device` (the useful reference) as the key
            for i in self.serial_ports:
                self.serial_port_details[i.device] = {
                    "device": i.device,
                    "name": i.name,
                    "description": i.description,
                    "hwid": i.hwid,
                    "vid": i.vid,
                    "pid": i.pid,
                    "serial_number": i.serial_number,
                    "location": i.location,
                    "manufacturer": i.manufacturer,
                    "product": i.product,
                    "interface": i.interface
                }
            # serial_ports_string = dictionary_keys_to_string(self.serial_port_details)
            self._logger.info("Available serial ports: " + dictionary_keys_to_string(self.serial_port_details))
            self._plugin_manager.send_plugin_message(self._identifier, dict(serial_ports=self.serial_port_details))
        # @TODO compare last and new dicts, return True if changed, False if no change. Only required if thread needs to be restarted as a result
        # as this is undesirable. If thread doesn't need to be stopped to update availability, no real point in doing this check here.
        return True

    def identify_printer_port(self):
        """Identify the current printer serial port and log the current situation."""
        self._logger.info("Identifying printer serial port...")
        self.printer_port = self._printer.get_current_connection()[1]
        if self.printer_port is not None:
            self._logger.info("Printer found. Ignoring current printer port " + self.printer_port + ".")
        else:
            self.printer_port = self._settings.global_get(["serial","port"])
            if self.printer_port == "AUTO":
                self._logger.info("Printer not connected and saved connection is set to " + self.printer_port + ". List will be rebuilt once printer is connected.")
            elif self.printer_port == None:
                self._logger.info("Printer not connected. No saved printer port found. List will be rebuilt once printer is connected.")
            else:
                self._logger.info("Printer not connected. Ignoring saved printer port " + self.printer_port + ".")

    def dictionary_keys_to_string(self, dictionary):
        """Create a single string containing a comma-separated list of all keys in the given dictionary"""
        keys_string = ""
        first = True
        for key in dictionary:
            if first:
                first = False
            else:
                keys_string += ", "
            keys_string += key
        return keys_string