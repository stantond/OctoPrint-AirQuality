import os
import re
import sys
import glob
import threading
import serial
from serial.tools import list_ports
import plantower, time

class SensorsManager():
    def __init__(self, plugin):
        self._logger = plugin._logger
        self._printer = plugin._printer
        self._plugin_manager = plugin._plugin_manager
        self._settings = plugin._settings

        self.serial_ports = []
        self.sensors = []
        self.find_serial_ports()
        # self.initialise_sensors()
        self.readThread = None
        self.readThreadStop = False
        self._connected = False
        self.serialConn = None
        # self.start_monitoring()

    def start_monitoring(self):
        # If > 0 active sensors then
        self.startReadThread()
        self._connected = True

    def initialise_sensors(self):
        self._logger.info("Initialising sensors...")
        sensor = plantower.Plantower(port=self._settings.get(["sensor_port"]))
        sensor.mode_change(plantower.PMS_PASSIVE_MODE)
        self.sensors.append(sensor)
        self._logger.info("Sensors ready")
        self._logger.info(self.sensors)

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
        self._logger.info("Building list of available serial devices...")
        self.serial_ports = list(list_ports.comports())
        printer_port = self._printer.get_current_connection()[1]
        if self._printer.get_current_connection()[1] is not None:
            self._logger.info("Printer found. Ignoring current printer port " + printer_port + ".")
        else:
            printer_port = self._settings.global_get(["serial","port"])
            if printer_port == "AUTO":
                self._logger.info("Printer not connected and saved connection is set to " + printer_port + ". List will be rebuilt once printer is connected.")
            elif printer_port == None:
                self._logger.info("Printer not connected. No saved printer port found. List will be rebuilt once printer is connected.")
            else:
                self._logger.info("Printer not connected. Ignoring saved printer port " + printer_port + ".")
        for i in self.serial_ports:
            if i.device == printer_port:
                self.serial_ports.remove(i)
        if len(self.serial_ports) == 0:
            self._logger.info("No serial ports available")
        else:
            for i in self.serial_ports:
                if i.device == printer_port:
                    self.serial_ports.remove(i)
                else:
                    port_attributes = ""
                    first = True
                    for j in i:
                        if first:
                            first = False
                        else:
                            port_attributes += ", "
                        port_attributes += j
                    self._logger.info("Detected serial port: " + port_attributes)

        # @TODO: Rebuild the list when the printer port changes
        # @TODO: When the list is rebuilt, disable sensors that are no longer valid


    # below code from https://gitlab.com/mosaic-mfg/palette-2-plugin/blob/master/octoprint_palette2/Omega.py
    def getAllPorts(self):
        baselist = []
        if 'win32' in sys.platform:
            self._logger.info("Using a windows machine")
            for port in serial.tools.list_ports.grep('.*0403:6015.*'):
                self._logger.info("Found port %s" % port.device)
                baselist.append(port.device)
        baselist = baselist + glob.glob('/dev/serial/by-id/*FTDI*') + glob.glob('/dev/*usbserial*') + glob.glob(
            '/dev/*usbmodem*')
        baselist = self.getRealPaths(baselist)
        baselist = list(set(baselist))  # get unique values only
        return baselist

    def getRealPaths(self, ports):
        self._logger.info("Paths: %s" % ports)
        for index, port in enumerate(ports):
            port = os.path.realpath(port)
            ports[index] = port
        return ports

    def isPrinterPort(self, selected_port):
        selected_port = os.path.realpath(selected_port)
        printer_port = self._printer.get_current_connection()[1]
        self._logger.info("Trying port: %s" % selected_port)
        self._logger.info("Printer port: %s" % printer_port)
        # because ports usually have a second available one (.tty or .cu)
        printer_port_alt = ""
        if printer_port is None:
            return False
        else:
            if "tty." in printer_port:
                printer_port_alt = printer_port.replace("tty.", "cu.", 1)
            elif "cu." in printer_port:
                printer_port_alt = printer_port.replace("cu.", "tty.", 1)
            self._logger.info("Printer port alt: %s" % printer_port_alt)
            if selected_port == printer_port or selected_port == printer_port_alt:
                return True
            else:
                return False

    def is_connected(self):
        return self._connected