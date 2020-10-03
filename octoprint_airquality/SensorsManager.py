import os
import re
import sys
import glob
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

        self.refresh_sensors()

        self.readThread = None
        self.readThreadStop = False
        self._connected = False
        self.serialConn = None
        # self.start_monitoring()

    def refresh_sensors(self, new_port=None):
        # If being called directly or as a result of the printer port changing
        if new_port == None or new_port != self.printer_port:
            self.find_serial_ports()
            self._plugin_manager.send_plugin_message(self._identifier, dict(serial_ports=self.serial_port_details))
        self.initialise_sensors()

    def start_monitoring(self):
        # @TODO If > 0 active sensors then
        self.startReadThread()
        self._connected = True

    def initialise_sensors(self):
        self._logger.info("Initialising sensors...")
        self.sensors = []
        devices = self.database_manager.get_devices()
        for device in devices:
            if device["port"] in self.serial_port_details.keys():
                device["reader"] = SensorReader(device["model"], device["port"], 0)
                self.sensors.append(device)
        print(self.sensors)
        # sensor = plantower.Plantower(port=self._settings.get(["sensor_port"]))
        # sensor.mode_change(plantower.PMS_PASSIVE_MODE)
        # self.sensors.append(sensor)
        self._logger.info("Sensors ready")
        # self._logger.info(self.sensors)

    def sensors_read_thread(self, sensors):
        self._logger.info("Sensors Read Thread Started")
        self._logger.info("Waking sensors")
        for sensor in sensors:
            sensor.set_to_wakeup()
        self._logger.info("Sensors are awake")
        self._logger.info("Starting Read Loop")
        time.sleep(30)
        while self.readThreadStop is False:
            for sensor in sensors:
                try:
                    result = sensor.read_in_passive()
                    self._logger.info(result)
                except serial.SerialException:
                    self._connected = False
                    self._logger.error("Error reading from sensor")
                    self.stopReadThread()
            time.sleep(30)
        self._logger.info("Sensors Read Thread Stopped")

    def startReadThread(self):
        if self.readThread is None:
            self.readThreadStop = False
            self.readThread = threading.Thread(
                target=self.sensors_read_thread,
                args=(self.sensors,)
            )
            self.readThread.daemon = True
            self.readThread.start()

    def stopReadThread(self):
        self.readThreadStop = True
        if self.readThread and threading.current_thread() != self.readThread:
            self.readThread.join()
        self.readThread = None

    # See https://pyserial.readthedocs.io/en/latest/tools.html#serial.tools.list_ports.ListPortInfo
    def find_serial_ports(self):
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

        # @TODO: When the list is rebuilt, disable sensors that are no longer valid

    def is_connected(self):
        return self._connected