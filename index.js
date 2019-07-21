var debug = require('debug')('homebridge-particle');
var request = require("request");
var eventSource = require('eventsource');
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform("homebridge-particle", "Particle", ParticlePlatform);
}

function ParticlePlatform(log, config){
	this.log = log;
	this.accessToken = config["access_token"];
	this.deviceId = config["deviceid"];
	this.url = config["cloudurl"];
	this.devices = config["devices"];
}

ParticlePlatform.prototype = {
	accessories: function(callback){
		var foundAccessories = [];

		var count = this.devices.length;

		for(index=0; index< count; ++index){
			var accessory  = new ParticleAccessory(
				this.log,
				this.url,
				this.accessToken,
				this.devices[index]);

			foundAccessories.push(accessory);
		}

		callback(foundAccessories);
	}
};

function ParticleAccessory(log, url, access_token, device) {
	this.log = log;
	this.name = device["name"],
	this.args = device["args"];
	this.deviceId = device["deviceid"];
	this.type = device["type"];
	this.functionName = device["function_name"];
	this.eventName = device["event_name"];
	this.sensorType = device["sensorType"];
	this.key = device["key"];
	this.accessToken = access_token;
	this.url = url;
	this.value = 20;

	debug(this.name + " = " + this.sensorType);

	this.services = [];

	this.informationService = new Service.AccessoryInformation();

	this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Particle")
		.setCharacteristic(Characteristic.Model, "Photon")
		.setCharacteristic(Characteristic.SerialNumber, "AA098BB09");

	this.services.push(this.informationService);

	if(this.type === "LIGHT"){
		this.lightService = new Service.Lightbulb(this.name);

		this.lightService
			.getCharacteristic(Characteristic.On)
			.on('set', this.setState.bind(this));

		this.services.push(this.lightService);
	}
	else if(this.type === "SWITCH"){
		this.switchService = new Service.Switch(this.name);

		this.switchService
			.getCharacteristic(Characteristic.On)
			.on('set', this.setState.bind(this));

		this.services.push(this.switchService);
	}
	else if(this.type === "SENSOR"){
		var service;

		console.log("Sensor Type: " + this.sensorType.toLowerCase());

		if(this.sensorType.toLowerCase() === "temperature"){
			console.log("Temperature Sensor");

			service = new Service.TemperatureSensor(this.name);

			service
				.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
          minValue: -256,
          maxValue: 512
        })
				.on('get', this.getDefaultValue.bind(this));
		}
		else if(this.sensorType.toLowerCase() === "humidity"){
			console.log("Humidity Sensor");

			service = new Service.HumiditySensor(this.name);

			service
				.getCharacteristic(Characteristic.CurrentRelativeHumidity)
				.on('get', this.getDefaultValue.bind(this));
		}
		else if(this.sensorType.toLowerCase() === "motion"){
			console.log("Motion Sensor");
			
			service = new Service.MotionSensor(this.name);
			
			service
				.getCharacteristic(Characteristic.MotionDetected)
				.on('get', this.getDefaultValue.bind(this));
		}
		else if(this.sensorType.toLowerCase() === "light"){
			console.log("Light Sensor");

			service = new Service.LightSensor(this.name);

			service
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.on('get', this.getDefaultValue.bind(this));
		}
		else if(this.sensorType.toLowerCase() === "motion"){
			console.log("Motion Sensor");

			service = new Service.MotionSensor(this.name);

			service
				.getCharacteristic(Characteristic.MotionDetected)
				.on('get', this.getDefaultValue.bind(this));
		}
		else if(this.sensorType.toLowerCase() === "contact"){
			console.log("Contact Sensor");

			service = new Service.ContactSensor(this.name);

			service
				.getCharacteristic(Characteristic.MotionDetected)
				.on('get', this.getDefaultValue.bind(this));
		}

		if(service != undefined){
			console.log("Initializing " + service.displayName + ", " + this.sensorType);

			var eventUrl = this.url + this.deviceId + "/events/" + this.eventName + "?access_token=" + this.accessToken;
			var es = new eventSource(eventUrl);

			debug(eventUrl);

			es.onerror = function() {
				console.log('ERROR!');
			};

			es.addEventListener(this.eventName,
				this.processEventData.bind(this), false);

			this.services.push(service);
		}
		console.log("Service Count: " + this.services.length);
	}
}

ParticleAccessory.prototype.setState = function(state, callback) {
	debug("Getting current state...");

	debug("URL: " + this.url);
	debug("Device ID: " + this.deviceId);

	var onUrl = this.url + this.deviceId + "/" + this.functionName;

	var argument = this.args.replace("{STATE}", (state ? "1" : "0"));

	debug("Calling function: " + onUrl + "?" + argument);

	request.post(
		onUrl, {
			form: {
				access_token: this.accessToken,
				args: argument
			}
		},
		function(error, response, body) {
			//console.log(response);

			if (!error) {
				callback();
			} else {
				callback(error);
			}
		}
	);
}

ParticleAccessory.prototype.processEventData = function(e){
	var data = JSON.parse(e.data);
	var tokens = data.data.split('=');

	debug(tokens[0] + " = " + tokens[1] + ", " + this.services[1].displayName + ", " + this.sensorType + ", " + this.key.toLowerCase() + ", " + tokens[0].toLowerCase());
	debug(this.services[1] != undefined && this.key.toLowerCase() === tokens[0].toLowerCase());

	if(this.services[1] != undefined && this.key.toLowerCase() === tokens[0].toLowerCase()){
		if (tokens[0].toLowerCase() === "temperature") {
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentTemperature)
				.setValue(parseFloat(tokens[1]));
		}
		else if (tokens[0].toLowerCase() === "humidity") {
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentRelativeHumidity)
				.setValue(parseFloat(tokens[1]));
		}
		else if (tokens[0].toLowerCase() === "light") {
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.setValue(parseFloat(tokens[1]));
		}
		else if (tokens[0].toLowerCase() === "switch") {
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.On)
				.setValue(parseFloat(tokens[1]));
		}
		else if (tokens[0].toLowerCase() === "motion") {
			this.value = parseFloat(tokens[1]);
			debug('Received ' + this.value);
			if (this.value === '1.00' || this.value === 1.00 || this.value === 'true' || this.value === 'TRUE') this.value = true;
      else if (this.value === '0.00' || this.value === 0.00 || this.value === 'false' || this.value === 'FALSE') this.value = false;
			if (this.value !== true && this.value !== false) {
        debug('Received value is not valid.');
     	} else {
      	this.services[1]
        .getCharacteristic(Characteristic.MotionDetected)
				.setValue(this.value);
      }
		}
		else if (tokens[0].toLowerCase() === "contact") {
			this.value = parseFloat(tokens[1]);
			debug('Received ' + this.value);
			if (this.value === '1.00' || this.value === 1.00 || this.value === 'true' || this.value === 'TRUE') this.value = true;
      else if (this.value === '0.00' || this.value === 0.00 || this.value === 'false' || this.value === 'FALSE') this.value = false;
			if (this.value !== true && this.value !== false) {
        debug('Received value is not valid.');
     	} else {
      	this.services[1]
        .getCharacteristic(Characteristic.ContactDetected)
				.setValue(this.value);
			}
    }
  }
}

ParticleAccessory.prototype.getDefaultValue = function(callback) {
	callback(null, this.value);
}

ParticleAccessory.prototype.setCurrentValue = function(value, callback) {
	debug("Value: " + value);

	callback(null, value);
}

ParticleAccessory.prototype.getServices = function() {
	return this.services;
}
