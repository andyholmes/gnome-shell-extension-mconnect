'use strict';

// Imports
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Signals = imports.signals

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, getSettings } = Me.imports.utils;

// DBus Interface
const DeviceProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device"> \
    <property type="s" name="Id" access="readwrite"/> \
    <property type="s" name="Name" access="readwrite"/> \
    <property type="s" name="DeviceType" access="readwrite"/> \
    <property type="u" name="ProtocolVersion" access="readwrite"/> \
    <property type="s" name="Address" access="readwrite"/> \
    <property type="b" name="IsPaired" access="readwrite"/> \
    <property type="b" name="Allowed" access="readwrite"/> \
    <property type="b" name="IsActive" access="readwrite"/> \
  </interface> \
</node> \
');

const ManagerProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.DeviceManager"> \
    <method name="AllowDevice"> \
      <arg type="s" name="path" direction="in"/> \
    </method> \
    <method name="ListDevices"> \
      <arg type="ao" name="result" direction="out"/> \
    </method> \
  </interface> \
</node> \
');


const _settings = getSettings();

// A DBus Interface wrapper for mconnect.Device
const Device = new Lang.Class({
    Name: "Device",
    
    _init: function (devicePath) {
        // Create proxy wrapper for DBus Interface
        try {
            this.proxy = new DeviceProxy(Gio.DBus.session,
                                         'org.mconnect',
                                         devicePath);
        } catch (e) {
            debug('DeviceProxy Error: ' + e);
        };
        
        // Properties
        Object.defineProperty(this, 'id', {
            get: function () { return this.proxy.Id; },
            set: function (arg) {}
        });
        debug('id: ' + this.id);
        
        Object.defineProperty(this, 'name', {
            get: function () { return this.proxy.Name; },
            set: function (name) { return name; }
        });
        debug('name: ' + this.name);
        
        Object.defineProperty(this, 'type', {
            get: function () { return this.proxy.DeviceType; },
            set: function (arg) {}
        });
        debug('type: ' + this.type);
        
        Object.defineProperty(this, 'version', {
            get: function () { return this.proxy.ProtocolVersion; },
            set: function (arg) {}
        });
        debug('version: ' + this.version);
        
        Object.defineProperty(this, 'address', {
            get: function () { return this.proxy.Address; },
            set: function (arg) {}
        });
        debug('address: ' + this.address);
        
        Object.defineProperty(this, 'paired', {
            get: function () { return this.proxy.IsPaired; },
            set: function (arg) {}
        });
        debug('paired: ' + this.paired);
        
        Object.defineProperty(this, 'allowed', {
            get: function () { return this.proxy.Allowed; },
            set: function (name) { return name; }
        });
        debug('allowed: ' + this.allowed);
        
        Object.defineProperty(this, 'active', {
            get: function () { return this.proxy.Allowed; },
            set: function (name) { return name; }
        });
        debug('active: ' + this.active);
        
        // Signals
        //this.proxy.connectSignal('deviceSignal', Lang.bind(this, this._deviceSignal));
    },
    
    // Callbacks
    //_deviceSignal: function (proxy, sender, user_data) {
    //    debug('re-emitting device:_deviceSignal as device::signal');
    //    
    //    this.emit('device::signal', user_data[0]);
    //},
    
    // Methods
    //deviceMethod: function () {
    //}
});

Signals.addSignalMethods(Device.prototype);


// A DBus Interface wrapper for mconnect.DeviceManager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    
    devices: {},
    
    _init: function () {
        // Connect to DBus
        let watcher = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            'org.mconnect',
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._daemonAppeared),
            Lang.bind(this, this._daemonVanished)
        );
        
        // Properties
        //Object.defineProperty(this, 'name', {
        //    get: function () { return this.name; },
        //    set: function (arg) { this.name = name; return this.name; }
        //});
        
        // Signals
        //this.proxy.connectSignal('managerSignal', Lang.bind(this, this._managerSignal));
    },
    
    // Private Methods
    _initDaemon: function () {
        // Start the mconnect daemon
        log('spawning mconnect daemon');
        
        try {
            Util.spawnCommandLine('mconnect -d');
            this.usleep(10000); // 10ms
        } catch (e) {
            debug('_initDaemon: ' + e);
        };
    },
    
    _initDevice: function (devicePath) {
        debug('initializing device at ' + devicePath);
        
        this.devices[devicePath] = new Device(devicePath);
    },
    
    _initDevices: function () {
        // Populate this.devices with Device objects
        debug('initializing devices');
        
        for (let devicePath of this._ListDevices()) {
            this._initDevice(devicePath);
        };
    },
    
    // Callbacks
    _daemonAppeared: function (conn, name, name_owner, user_data) {
        // The DBus interface has appeared, setup
        try {
            // Create proxy wrapper for DBus Interface
            this.proxy = new ManagerProxy(Gio.DBus.session,
                                          'org.mconnect',
                                          '/org/mconnect/manager');
            this._initDevices();
            this.emit('daemon-connected', this.devices)
        } catch (e) {
            throw new Error(e);
        };
    },
    
    _daemonVanished: function (conn, name, name_owner, user_data) {
        // The DBus interface has vanished, clean up
        this.emit('daemon-disconnected', Object.keys(this.devices))
        debug('daemon-disconnected emitted');
        this.proxy = null;
        this.devices = {};
        
        if (_settings.get_boolean('start-daemon')) {
            this._initDaemon();
        } else if (!_settings.get_boolean('wait-daemon')) {
            throw new Error('no daemon and not allowed to start or wait');
        };
    },
    
    // Methods: remove the DBus cruft
    _AllowDevice: function (devicePath) {
        // Params: String device, Returns: null
        return this.proxy.AllowDeviceSync(string)[0];
    },
    
    _ListDevices: function () {
        // Params: null, Returns: Array objectPaths
        // NOTE: DBus returns nested arrays
        return this.proxy.ListDevicesSync()[0];
    }
});

Signals.addSignalMethods(DeviceManager.prototype);




