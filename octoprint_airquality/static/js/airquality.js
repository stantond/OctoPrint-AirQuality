/*
 * View model for OctoPrint-AirQuality
 *
 * Author: Daniel Stanton
 * License: AGPLv3
 */
$(function() {
    function AirQualityViewModel(parameters) {
        var self = this;

        self.supportedDevices = {
            "5003": "Plantower PMS5003",
            "7003": "Plantower PMS7003",
            "A003": "Plantower PMSA003"
        };

        self.settings = parameters[0];
        self.arrDevices = ko.observableArray();
        self.serialPorts = {};
        self.serialPortsList = ko.observableArray();
        self.selectedDevice = ko.observable();
        self.selectedDeviceIndex = 0;
        self.unsavedChanges = ko.observable(false);

        /* Used by the Edit template to show a warning when the selected port is unavailable */
        self.portUnavailable = ko.computed(function() {
            if (self.selectedDevice() !== undefined) {
                if (self.serialPortsList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    return true;
                } else {
                    return false;
                };
            };
        });

        /* Provides a list of serial ports for the user to choose from during device edit,
        including the currently set port even if it's not plugged in, and
        excluding ports already in use by this plugin for other devices */
        self.serialPortsListEdit = ko.computed(function() {
            var fullList = [];
            fullList.push(...self.serialPortsList());
            ko.utils.arrayForEach(self.arrDevices(), function(device) {
                if (device.port() !== null && device.port() !== undefined){
                    var index = fullList.indexOf(device.port());
                    if (index > -1) {
                        fullList.splice(index, 1);
                      }
                }
            });
            if (self.selectedDevice() !== undefined) {
                if (fullList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    fullList.push(ko.toJS(self.selectedDevice().port()));
                };
            };
            return fullList;
        });

        /* Shows or hides the Unsaved Changes warning whenever the array of devices is changed */
        ko.computed(function() {
            return ko.toJSON(self.arrDevices);
        }).subscribe(function() {
            var unsavedDevices = (ko.toJSON(self.arrDevices()) !== ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
            if (unsavedDevices) {
                self.unsavedChanges(true);
            } else {
                self.unsavedChanges(false);
            };
        });

        self.models = ko.observableArray(mapDictionaryToArray(self.supportedDevices));

        self.alertMessage = ko.observable("");
        self.alertType = ko.observable("alert-warning");
        self.showAlert = ko.observable(false);

        self.getPrettyDeviceName = function(model) {
            return self.supportedDevices[model];
        }

        /* Manually push each existing setting into JS objects to allow them to be
        edited without immediately changing the underlying stored values */
        self.onBeforeBinding = function() {
            var settingsArrDevicesJS = ko.mapping.toJS(self.settings.settings.plugins.airquality.arrDevices());
            settingsArrDevicesJS.forEach(function(device){
                device = {
                    'location':ko.observable(device.location),
                    'model':ko.observable(device.model),
                    'name':ko.observable(device.name),
                    'port':ko.observable(device.port)
                };
                self.arrDevices.push(device);
            });
            
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices?
        }

        self.onDataUpdaterPluginMessage = function(pluginName, message) {
            if (pluginName != "airquality") {
                // Ignore messages for other plugins
				return;
            }
            if (message.serial_ports) {
                // Store the updated dictionary of serial ports
                self.serialPorts = message.serial_ports;
                self.serialPortsList(Object.keys(self.serialPorts));
            }
        }

        self.hideAlert = function() {
            self.showAlert(false);
        }

        /* User can manually the backend to check for available sensors. The actual
        dictionary of updated sensors comes back using the Plugin Message mechanism.
        Disables the button until the flash message has cleared. */
        self.refreshSensors = function(button=null) {
            var alert = undefined;
            button.disabled=true;
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "refresh_sensors"
                }),
                contentType: "application/json; charset=UTF-8",
                success: function(responseText) {
                    if(button!==null) {
                        alertText = gettext(responseText["message"]);
                        self.alertType("alert-success");
                        self.alertMessage(alertText);
                        self.showAlert(true);
                        setTimeout(function() {
                            self.showAlert(false);
                        }, 3000);
                        setTimeout(function() {
                            button.disabled=false;
                        }, 3000);
                    }
                },
                error: function(responseText, errorThrown) { 
                    if(button!==null) {
                        alert = gettext(responseText["message"] + ": " + errorThrown);
                        self.alertType("alert-error");
                        self.alertMessage(alertText);
                        self.showAlert(true);
                        setTimeout(function() {
                            button.disabled=false;
                        }, 5000);
                    }
                } 
            })
        }

        /* Silently ask the backend to check for available sensors when the settings screen is shown.
        The actual dictionary of updated sensors comes back using the Plugin Message mechanism*/
        self.onSettingsShown = function() {
            $.ajax({
                url: API_BASEURL + "plugin/airquality",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "refresh_sensors"
                }),
                contentType: "application/json; charset=UTF-8"
            })
        }

        /* Saves changes made to the temporary settings objects into the settings file,
        causing them to be applied, and hides the Unsaved Changes message */
        self.onSettingsBeforeSave = function(payload) {
            var unsavedDevices = (ko.toJSON(self.arrDevices()) !== ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
            if (unsavedDevices) {
                self.settings.settings.plugins.airquality.arrDevices(self.arrDevices());
                self.unsavedChanges(false);
            };
            // @TODO restart the sensor thread to apply the new changes
        }

        /* Shows the Add Device modal. Provide an empty set of observables for Add Device functionality */
        self.showAddDeviceModal = function() {
            self.selectedDevice({
                'location':ko.observable(''),
                'model':ko.observable(''),
                'name':ko.observable(''),
                'port':ko.observable('')
            });
            $("#AirQualityDeviceAddModal").modal("show");
        }

        /* Add the new device to the temporary devices array */
        self.addDevice = function() {
            self.arrDevices.push(self.selectedDevice());
        }

        /* Shows the Edit Device modal. Stores the index so that changes can be applied to the array
        on confirmation instead of instantly */
        self.showEditDeviceModal = function(device) {
            nonObservableDevice = ko.toJS(device);
            nonObservableArray = ko.toJS(self.arrDevices);
            self.selectedDeviceIndex = nonObservableArray.findIndex(function(item) {
                return ko.toJSON(nonObservableDevice) == ko.toJSON(item);
            });
            self.selectedDevice({
                'location':ko.observable(nonObservableDevice["location"]),
                'model':ko.observable(nonObservableDevice["model"]),
                'name':ko.observable(nonObservableDevice["name"]),
                'port':ko.observable(nonObservableDevice["port"])
            });
            $("#AirQualityDeviceEditModal").modal("show");
        }

        /* Apply the changes to the temporary devices array. By copying instead of relying on observables,
        edit does not make changes to the array until the user confirms this is what they want.
        Empty selections are stored as empty strings for consistency. */
        // @todo make sure it's still OK to use "" instead of null when checking for ports in backend
        self.applyEditDevice = function(device) {
            nonObservableDevice = ko.toJS(device);
            self.arrDevices()[self.selectedDeviceIndex].location(nonObservableDevice["location"]);
            self.arrDevices()[self.selectedDeviceIndex].model(nonObservableDevice["model"] ?? "");
            self.arrDevices()[self.selectedDeviceIndex].name(nonObservableDevice["name"]);
            self.arrDevices()[self.selectedDeviceIndex].port(nonObservableDevice["port"] ?? "");
        }

        /* Removes the passed device from the temporary devices array. */
        self.removeDevice = function(device) {
            self.arrDevices.remove(device);
        }
    }

    /* Utility function to make dictionaries into an array that a ko.observable can use */
    function mapDictionaryToArray(dictionary) {
        var result = [];
        for (var key in dictionary) {
            if (dictionary.hasOwnProperty(key)) {
                result.push({ key: key, value: dictionary[key] });
            }
        }
        return result;
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AirQualityViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#settings_plugin_airquality"]
    });
});
