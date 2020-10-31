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

        self.printer_port = ""
        self.serial_ports = []
        self.sensors = []

        self.readThread = None
        self.readThreadActive = False
        self.serialConn = None

        self.refresh_sensors()
        self.build_sensors_list()
        self.start_sensors_read_thread()

    def refresh_sensors(self, new_port=None):
        # If being called directly or as a result of the printer port changing
        if new_port == None or new_port != self.printer_port:
            self.update_serial_ports()
        self.build_sensors_list()
        self.start_sensors_read_thread()

    def build_sensors_list(self):
        self.stop_sensors_read_thread()
        self._logger.info("Initialising sensors...")
        self.sensors = []
        devices = self.database_manager.get_devices()
        for device in devices:
            if device["port"] in self.serial_port_details.keys():
                device["reader"] = SensorReader(device["model"], device["port"], 0)
                self.sensors.append(device)
        print(self.sensors)
        self._logger.info("Sensors ready")

    def sensors_read_thread(self):
        self._logger.info("Starting Sensor Read Loop")
        while self.readThreadActive is True:
            for sensor in self.sensors:
                try:
                    with sensor["reader"] as reader:
                        print("trying to read")
                        # @todo handle octoprint stealing the serial port until it figures out it's wrong
                        # @todo handle when reading.thing doesn't exist
                        # @todo handle all the other possible readings
                        self.database_manager.insert_reading(sensor["id"], sensor["location_id"], next(reader()))
                except serial.SerialException:
                    self._logger.error("Error reading from sensor")
                    self.stop_sensors_read_thread()
            time.sleep(5)
        self._logger.info("Sensors Read Thread Stopped")

    def start_sensors_read_thread(self):
        if self.readThread is None:
            self.set_sensors_read_thread_active_status(True)
            self.readThread = threading.Thread(
                target=self.sensors_read_thread,
                # args=(self.sensors,)
            )
            self.readThread.daemon = True
            self.readThread.start()

    def stop_sensors_read_thread(self):
        self.set_sensors_read_thread_active_status(False)
        if self.readThread and threading.current_thread() != self.readThread:
            self.readThread.join()
        self.readThread = None

    def set_sensors_read_thread_active_status(self, status):
        self.readThreadActive = status
        self._logger.info("Sensor Read Thread status set to " + str(self.readThreadActive))
        self._plugin_manager.send_plugin_message(self._identifier, dict(sensors_read_thread_active_status=str(self.readThreadActive).lower()))

    # See https://pyserial.readthedocs.io/en/latest/tools.html#serial.tools.list_ports.ListPortInfo
    def update_serial_ports(self):
        self.serial_port_details = {}
        self._logger.info("Building list of available serial devices...")
        self.serial_ports = list(list_ports.comports())
        self.printer_port = self._printer.get_current_connection()[1]
        if self._printer.get_current_connection()[1] is not None:
            self._logger.info("Printer found. Ignoring current printer port " + self.printer_port + ".")
        else:
            self.printer_port = self._settings.global_get(["serial","port"])
            if self.printer_port == "AUTO":
                self._logger.info("Printer not connected and saved connection is set to " + self.printer_port + ". List will be rebuilt once printer is connected.")
            elif self.printer_port == None:
                self._logger.info("Printer not connected. No saved printer port found. List will be rebuilt once printer is connected.")
            else:
                self._logger.info("Printer not connected. Ignoring saved printer port " + self.printer_port + ".")
        for i in self.serial_ports:
            if i.device == self.printer_port:
                self.serial_ports.remove(i)
        if len(self.serial_ports) == 0:
            self._logger.info("No serial ports available")
        else:
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
            keys_string = ""
            first = True
            for key in self.serial_port_details.keys():
                if first:
                    first = False
                else:
                    keys_string += ", "
                keys_string += key
            self._logger.info("Available serial ports: " + keys_string)
            self._plugin_manager.send_plugin_message(self._identifier, dict(serial_ports=self.serial_port_details))

        # @TODO: When the list is rebuilt, disable sensors that are no longer valid