/*
 * View model for OctoPrint-AirQuality
 *
 * Author: Daniel Stanton
 * License: AGPLv3
 */
$(function() {
    function AirQualityViewModel(parameters) {
        var self = this;

        self.settings = parameters[0];
        self.arrDevices = ko.observableArray();
        self.serialPorts = {};
        self.serialPortsList = ko.observableArray();
        self.selectedDevice = ko.observable();
        self.selectedDeviceIndex = 0;
        // self.supportedDevices = {
        //     "Plantower PMS5003": "5003",
        //     "Plantower PMS7003": "7003",
        //     "Plantower PMSA003": "A003"
        // }
        self.serialPortsListEdit = ko.computed(function() {
            var fullList = [];
            if (self.selectedDevice() !== undefined) {
                console.log("selected device port: " + self.selectedDevice().port());
                console.log("port in list: " + self.serialPortsList.indexOf(self.selectedDevice().port()));
                if (self.serialPortsList.indexOf(self.selectedDevice().port()) === -1) {
                    fullList.push(self.selectedDevice().port());
                };
            };
            
            fullList.push(...self.serialPortsList());
            console.log(fullList);
            return fullList;
        }, self);

        self.supportedDevices = {
            "5003": "Plantower PMS5003",
            "7003": "Plantower PMS7003",
            "A003": "Plantower PMSA003"
        };

        self.models = ko.observableArray(mapDictionaryToArray(self.supportedDevices));

        self.alertMessage = ko.observable("");
        self.alertType = ko.observable("alert-warning");
        self.showAlert = ko.observable(false);

        self.getPrettyDeviceName = function(model) {
            return self.supportedDevices[model];
        }

        self.onBeforeBinding = function() {
            self.arrDevices(self.settings.settings.plugins.airquality.arrDevices());
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices
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
        // self.onSettingsBeforeSave = function(payload) {
        //     var devices_updated = (ko.toJSON(self.arrDevices()) !== ko.toJSON(self.settings.settings.plugins.airquality.arrDevices()));
        //     self.arrDevices(self.settings.settings.plugins.airquality.arrDevices());
        //     if(devices_updated){
        //         // TODO reload devices
        //     }
        // }

        self.showAddDeviceModal = function() {
            self.selectedDevice({
                'name':ko.observable(''),
                'model':ko.observable(''),
                'location':ko.observable(''),
                'port':ko.observable('')
            });
            $("#AirQualityDeviceAddModal").modal("show");
        }

        self.addDeviceToSettings = function() {
            self.settings.settings.plugins.airquality.arrDevices.push(self.selectedDevice());
        }

        self.showEditDeviceModal = function(device) {
            self.selectedDeviceIndex = self.settings.settings.plugins.airquality.arrDevices.indexOf(device);
            nonObservableDevice = ko.toJS(device);
            self.selectedDevice({
                'name':ko.observable(nonObservableDevice["name"]),
                'model':ko.observable(nonObservableDevice["model"]),
                'location':ko.observable(nonObservableDevice["location"]),
                'port':ko.observable(nonObservableDevice["port"])
            });
            $("#AirQualityDeviceEditModal").modal("show");
        }

        self.applyEditDeviceToSettings = function(device) {
            nonObservableDevice = ko.toJS(device);
            self.settings.settings.plugins.airquality.arrDevices()[self.selectedDeviceIndex].name(nonObservableDevice["name"]);
            self.settings.settings.plugins.airquality.arrDevices()[self.selectedDeviceIndex].model(nonObservableDevice["model"]);
            self.settings.settings.plugins.airquality.arrDevices()[self.selectedDeviceIndex].location(nonObservableDevice["location"]);
            self.settings.settings.plugins.airquality.arrDevices()[self.selectedDeviceIndex].port(nonObservableDevice["port"]);
        }

        self.removeDevice = function(device) {
            self.settings.settings.plugins.airquality.arrDevices.remove(device);
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
