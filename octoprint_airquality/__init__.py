# coding=utf-8
from __future__ import absolute_import

### (Don't forget to remove me)
# This is a basic skeleton for your plugin's __init__.py. You probably want to adjust the class name of your plugin
# as well as the plugin mixins it's subclassing from. This is really just a basic skeleton to get you started,
# defining your plugin as a template plugin, settings and asset plugin. Feel free to add or remove mixins
# as necessary.
#
# Take a look at the documentation on what other plugin mixins are available.

import flask
import json
import octoprint.plugin
import time
from octoprint.server import user_permission
from . import DatabaseManager, SensorsManager

class AirqualityPlugin(octoprint.plugin.SettingsPlugin,
                       octoprint.plugin.AssetPlugin,
                       octoprint.plugin.TemplatePlugin,
					   octoprint.plugin.StartupPlugin,
					   octoprint.plugin.EventHandlerPlugin,
					   octoprint.plugin.SimpleApiPlugin):

	def on_after_startup(self):
		self.database_manager = DatabaseManager.DatabaseManager(self)
		self.sensors_manager = SensorsManager.SensorsManager(self, self.database_manager)
		if self._settings.get(["start_reading_on_startup"]) == True:
			time.sleep(10)
			self.sensors_manager.start_sensors_read_thread()

	##~~ SettingsPlugin mixin

	def get_settings_defaults(self):
		return dict(
			start_reading_on_startup=True,
		)

	##~~ TemplatePlugin mixin

	def get_template_configs(self):
		return [
			dict(type="navbar", custom_bindings=False),
			dict(type="settings", custom_bindings=True)
		]

	##~~ AssetPlugin mixin

	def get_assets(self):
		# Define your plugin's asset files to automatically include in the
		# core UI here.
		return dict(
			js=["js/jquery-ui.min.js","js/knockout-sortable.js","js/ko.observableDictionary.js","js/airquality.js"],
			css=["css/airquality.css"],
			less=["less/airquality.less"]
		)

	##~~ EventHandlerPlugin mixin

	def on_event(self, event, payload):
		if event == "Connected":
			"""Refresh sensors when the printer port changes to ensure there is no conflict."""
			try:
				if payload["port"] != self.sensors_manager.printer_port:
					self.sensors_manager.refresh_available_serial_ports()
			except AttributeError:
				# As this event also fires for a connection during start-up,
				# `sensor_manager` may not exist yet, so we can safely catch
				# and ignore this error.
				pass

	##~~ SimpleApiPlugin mixin

	def get_api_commands(self):
		return dict(
			create_device=[],
			get_devices=[],
			update_device=[],
			delete_device=[],
			create_location=[],
			get_locations=[],
			update_location=[],
			delete_location=[],
			refresh_available_serial_ports=[],
			start_sensor_read=[],
			stop_sensor_read=[],
		)

	def on_api_command(self, command, data):
		if not user_permission.can():
			return flask.make_response("User does not have permission", 403)
		self._logger.info("API command received: " + command)
		if command == "create_device":
			try:
				self.database_manager.insert_device(data["device"])
				return flask.make_response('{"message": "Device created"}', 201)
			except:
				return flask.make_response('{"message": "Failed to create device"}', 500)
		elif command == "get_devices":
			try:
				devices = self.database_manager.get_devices()
				response = flask.make_response(flask.jsonify({"devices": devices}), 200)
				response.headers["Content-Type"] = "application/json"
				return response
			except:
				return flask.make_response('{"message": "Failed to get devices"}', 500)
		elif command == "update_device":
			try:
				self.database_manager.update_device(data["device"])
				# @TODO inform the user that they must restart the sensor thread to apply their changes
				return flask.make_response('{"message": "Device updated"}', 200)
			except:
				return flask.make_response('{"message": "Failed to update device"}', 500)
		elif command == "delete_device":
			try:
				self.database_manager.delete_device(data["device"])
				return flask.make_response('{"message": "Device deleted"}', 200)
				return response
			except:
				return flask.make_response('{"message": "Failed to delete device"}', 500)
		elif command == "create_location":
			try:
				self.database_manager.insert_location(data["location"])
				return flask.make_response('{"message": "Location created"}', 201)
			except:
				return flask.make_response('{"message": "Failed to create location"}', 500)
		elif command == "get_locations":
			try:
				locations = self.database_manager.get_locations()
				response = flask.make_response(flask.jsonify({"locations": locations}), 200)
				response.headers["Content-Type"] = "application/json"
				return response
			except:
				return flask.make_response('{"message": "Failed to get devices"}', 500)
		elif command == "update_location":
			try:
				self.database_manager.update_location(data["location"])
				return flask.make_response('{"message": "Location updated"}', 200)
			except:
				return flask.make_response('{"message": "Failed to update location"}', 500)
		elif command == "delete_location":
			try:
				self.database_manager.delete_location(data["location"])
				return flask.make_response('{"message": "Location deleted"}', 200)
				return response
			except:
				return flask.make_response('{"message": "Failed to delete device"}', 500)
		elif command == "refresh_available_serial_ports":
			try:
				self.sensors_manager.refresh_available_serial_ports()
				return flask.make_response('{"message": "Serial port availability refreshed"}', 200)
			except:
				return flask.make_response('{"message": "Failed to refresh serial port availability"}', 500)
		elif command == "start_sensor_read":
			try:
				if self.sensors_manager.read_thread_active == False:
					self.sensors_manager.set_sensors_read_thread_active_status(True)
					return flask.make_response('{"message": "Sensors Read Thread started"}', 200)
				else:
					return flask.make_response('{"message": "Sensors Read Thread is already running"}', 200)
			except:
				return flask.make_response('{"message": "Failed to start the Sensors Read Thread"}', 500)
		elif command == "stop_sensor_read":
			try:
				if self.sensors_manager.read_thread_active == True:
					self.sensors_manager.set_sensors_read_thread_active_status(False)
					return flask.make_response('{"message": "Sensors Read Thread stopped"}', 200)
				else:
					return flask.make_response('{"message": "Sensors Read Thread is already stopped"}', 200)
			except:
				return flask.make_response('{"message": "Failed to stop the Sensors Read Thread"}', 500)

	##~~ Softwareupdate hook

	def get_update_information(self):
		# Define the configuration for your plugin to use with the Software Update
		# Plugin here. See https://github.com/foosel/OctoPrint/wiki/Plugin:-Software-Update
		# for details.
		return dict(
			airquality=dict(
				displayName="Air Quality Plugin",
				displayVersion=self._plugin_version,

				# version check: github repository
				type="github_release",
				user="stantond",
				repo="OctoPrint-AirQuality",
				current=self._plugin_version,

				# update method: pip
				pip="https://github.com/stantond/OctoPrint-AirQuality/archive/{target_version}.zip"
			)
		)


# If you want your plugin to be registered within OctoPrint under a different name than what you defined in setup.py
# ("OctoPrint-PluginSkeleton"), you may define that here. Same goes for the other metadata derived from setup.py that
# can be overwritten via __plugin_xyz__ control properties. See the documentation for that.
__plugin_name__ = "Air Quality Plugin"

# Starting with OctoPrint 1.4.0 OctoPrint will also support to run under Python 3 in addition to the deprecated
# Python 2. New plugins should make sure to run under both versions for now. Uncomment one of the following
# compatibility flags according to what Python versions your plugin supports!
#__plugin_pythoncompat__ = ">=2.7,<3" # only python 2
__plugin_pythoncompat__ = ">=3,<4" # only python 3
#__plugin_pythoncompat__ = ">=2.7,<4" # python 2 and 3

def __plugin_load__():
	global __plugin_implementation__
	__plugin_implementation__ = AirqualityPlugin()

	global __plugin_hooks__
	__plugin_hooks__ = {
		"octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
	}

