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
        self.selectedDevice = ko.observable();
        self.selectedDeviceIndex = 0;
        // self.supportedDevices = {
        //     "Plantower PMS5003": "5003",
        //     "Plantower PMS7003": "7003",
        //     "Plantower PMSA003": "A003"
        // }
        self.supportedDevices = {
            "5003": "Plantower PMS5003",
            "7003": "Plantower PMS7003",
            "A003": "Plantower PMSA003"
        }

        self.models = ko.observableArray(mapDictionaryToArray(self.supportedDevices));

        self.getPrettyDeviceName = function(model) {
            return self.supportedDevices[model];
        }

        self.onBeforeBinding = function() {
            self.arrDevices(self.settings.settings.plugins.airquality.arrDevices());
        }

        self.onAfterBinding = function() {
            // TODO handle missing devices
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
            self.selectedDevice({
                'name':ko.observable(device.name()),
                'model':ko.observable(device.model()),
                'location':ko.observable(device.location()),
                'port':ko.observable(device.port())
            });
            console.log(self.selectedDevice.name())
            $("#AirQualityDeviceEditModal").modal("show");
        }

        self.applyEditDeviceToSettings = function(device) {
            self.settings.settings.plugins.airquality.arrDevices[self.selectedDeviceIndex] = {
                'name': self.selectedDevice.name,
                'model': self.selectedDevice.model,
                'location': self.selectedDevice.location,
                'port': self.selectedDevice.port
            }
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
