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

        self.getPrettyDeviceName = function(key) {
            console.log(key);
            console.log(self.supportedDevices[key]);
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

        self.addDevice = function() {
            self.selectedDevice({
                'name':ko.observable(''),
                'models':ko.observableArray(mapDictionaryToArray(self.supportedDevices)),
                'model':ko.observable(''),
                'location':ko.observable(''),
                'port':ko.observable('')
            });
            $("#AirQualityDeviceEditor").modal("show");
        }

        self.addDeviceToSettings = function() {
            delete self.selectedDevice['models'];
            self.settings.settings.plugins.airquality.arrDevices.push(self.selectedDevice());
        }

        self.editDevice = function(device) {
            self.selectedDevice(device);
            $("#AirQualityDeviceEditor").modal("show");
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
