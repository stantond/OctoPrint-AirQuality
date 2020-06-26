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

        self.portUnavailable = ko.computed(function() {
            if (self.selectedDevice() !== undefined) {
                if (self.serialPortsList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    return true;
                } else {
                    return false;
                };
            };
        });

        self.serialPortsListEdit = ko.computed(function() {
            var fullList = [];
            fullList.push(...self.serialPortsList());
            if (self.selectedDevice() !== undefined) {
                if (fullList.indexOf(self.selectedDevice().port()) == -1 && self.selectedDevice().port() !== undefined) {
                    fullList.push(ko.toJS(self.selectedDevice().port()));
                };
            };
            return fullList;
        });

        ko.computed(function() {
            return ko.toJSON(self.arrDevices);
        }).subscribe(function() {
            // @TODO find out why settings arrDevices and observable arrDevices are always identical
            console.log("change to arrDevices detected");
            console.log("js arrDevices");
            console.log(ko.toJSON(self.arrDevices()));
            console.log("settings arrDevices");
            console.log(ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
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

        self.onBeforeBinding = function() {
            self.arrDevices.push(...self.settings.settings.plugins.airquality.arrDevices());
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices?
        }

        self.onDataUpdaterPluginMessage = function(pluginName, message) {
            if (pluginName == "airquality") {
                self.serialPorts = message;
                self.serialPortsList(Object.keys(self.serialPorts));
            }
        }

        self.hideAlert = function() {
            self.showAlert(false);
        }

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

        self.onSettingsBeforeSave = function(payload) {
            // @TODO Save settings only when the Save button is pressed, and restart the sensor thread
            var unsavedDevices = (ko.toJSON(self.arrDevices()) !== ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
            console.log("before");
            console.log(self.settings.settings.plugins.airquality.arrDevices());
            if (unsavedDevices) {
                self.settings.settings.plugins.airquality.arrDevices(ko.toJS(self.arrDevices()));
            };
            console.log("after");
            console.log(self.settings.settings.plugins.airquality.arrDevices());
        }

        self.showAddDeviceModal = function() {
            self.selectedDevice({
                'name':ko.observable(''),
                'model':ko.observable(''),
                'location':ko.observable(''),
                'port':ko.observable('')
            });
            $("#AirQualityDeviceAddModal").modal("show");
        }

        self.addDevice = function() {
            self.arrDevices.push(self.selectedDevice());
        }

        self.showEditDeviceModal = function(device) {
            self.selectedDeviceIndex = self.arrDevices.indexOf(device);
            nonObservableDevice = ko.toJS(device);
            self.selectedDevice({
                'name':ko.observable(nonObservableDevice["name"]),
                'model':ko.observable(nonObservableDevice["model"]),
                'location':ko.observable(nonObservableDevice["location"]),
                'port':ko.observable(nonObservableDevice["port"])
            });
            $("#AirQualityDeviceEditModal").modal("show");
        }

        self.applyEditDevice = function(device) {
            // @todo Ensure that port is not in use by multiple devices
            nonObservableDevice = ko.toJS(device);
            self.arrDevices()[self.selectedDeviceIndex].name(nonObservableDevice["name"]);
            self.arrDevices()[self.selectedDeviceIndex].model(nonObservableDevice["model"]);
            self.arrDevices()[self.selectedDeviceIndex].location(nonObservableDevice["location"]);
            self.arrDevices()[self.selectedDeviceIndex].port(nonObservableDevice["port"]);
        }

        self.removeDevice = function(device) {
            self.arrDevices.remove(device);
        }
    }

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
