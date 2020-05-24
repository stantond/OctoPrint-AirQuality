import os
import re
import sys
import glob
import threading
import serial
import serial.tools.list_ports
import plantower, time

class SensorsManager():
    def __init__(self, plugin):
        self._logger = plugin._logger
        self._printer = plugin._printer
        self._plugin_manager = plugin._plugin_manager
        self._settings = plugin._settings

        self.ports = []
        self.sensors = []
        self.updatePortsList()
        self.build_sensors_list()
        self.readThread = None
        self.readThreadStop = False
        self._connected = False
        self.serialConn = None
        self.start_monitoring()

    def start_monitoring(self):
        self.startReadThread()
        self._connected = True

    def build_sensors_list(self):
        self._logger.info("Building sensor list...")
        sensor = plantower.Plantower(port=self._settings.get(["sensor_port"]))
        sensor.mode_change(plantower.PMS_PASSIVE_MODE)
        self.sensors.append(sensor)
        self._logger.info("Sensor list built")
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

    def updatePortsList(self):
        self.ports = self.getAllPorts()
        if len(self.ports) > 0:
            for port in self.ports:
                if self.isPrinterPort(port):
                    self._logger.info("Removing Printer Port: " + port)
                    self.ports.remove(port)
        if len(self.ports) == 0:
            self._logger.info("No ports found")

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