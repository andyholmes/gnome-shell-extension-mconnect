'use strict';

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;


// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.prefs;

// Constants
const BUS_NAME = 'org.mconnect';


// DBus Interface Proxies
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
    <property type="as" name="IncomingCapabilities" access="readwrite"/> \
    <property type="as" name="OutgoingCapabilities" access="readwrite"/> \
  </interface> \
</node> \
');


// module Methods
function startDaemon() {
    // Start the mconnect daemon
    log('spawning mconnect daemon');
    
    try {
        Util.spawnCommandLine('mconnect -d');
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug('startDaemon: ' + e);
    };
};


// Plugins
const BatteryProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device.Battery"> \
    <signal name="Battery"> \
      <arg type="u" name="level"/> \
      <arg type="b" name="charging"/> \
    </signal> \
  </interface> \
</node> \
');

const PingProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');

// A DBus Interface wrapper for org.connect.Device.Battery
const Battery = new Lang.Class({
    Name: "Battery",
    
    _init: function (device) {
        debug('initializing battery plugin');
        
        // Create proxy for the DBus Interface
        this.proxy = new BatteryProxy(
            Gio.DBus.session,
            'org.mconnect',
            device.busPath
        );
        
        // Properties
        this.device = device;
        
        // TODO: will be a DBus property/method, for now use the Battery
        //        signal to update this variable
        this._charging = false;
        Object.defineProperty(this, 'charging', {
            get: function () { return this._charging; },
            set: function (charging) { this._charging = charging; }
        });
        debug('Device.battery.charging: ' + this.charging);
        
        // TODO: will be a DBus property/method, for now use the Battery
        //        signal to update this variable
        this._level = 0;
        Object.defineProperty(this, 'level', {
            get: function () { return this._level; },
            set: function (arg) { return this._level; }
        });
        debug('Device.battery.level: ' + this.level);
        
        this.proxy.connectSignal(
            'Battery',
            Lang.bind(
                this,
                function (proxy, sender, cb_data) {
                    debug(this.device.busPath + ' emitted Battery: ' + cb_data);
                    
                    // have the device re-emit the signal
                    this.device.emit('battery', null, cb_data);
                }
            )
        );
    },
    
    destroy: function () {
        // TODO: more
        delete this.proxy;
    }
});

Signals.addSignalMethods(Battery.prototype);

// A DBus Interface wrapper for org.connect.Device.Battery
const Ping = new Lang.Class({
    Name: "Ping",
    
    _init: function (device) {
        debug('initializing ping plugin');
        
        // Create proxy for the DBus Interface
        this.proxy = new PingProxy(
            Gio.DBus.session,
            'org.mconnect',
            device.busPath
        );
        
        // Properties
        this.device = device;
        
        this.proxy.connectSignal(
            'Ping',
            Lang.bind(
                this,
                function (proxy, sender, cb_data) {
                    debug(this.device.busPath + ' emitted Ping');
                    
                    // have the device re-emit the signal
                    this.device.emit('ping', cb_data);
                }
            )
        );
    },
    
    destroy: function () {
        // TODO: more
        delete this.proxy;
    }
});

Signals.addSignalMethods(Battery.prototype);

const Plugins = {
    'battery': Battery,
    'ping': Ping
};


// A DBus Interface wrapper for org.mconnect.Device
const Device = new Lang.Class({
    Name: 'Device',
    
    _init: function (busPath) {
        // Create proxy for the DBus Interface
        this.proxy = new DeviceProxy(Gio.DBus.session, 'org.mconnect', busPath);
        
        // Properties
        this.busPath = busPath;
        this.plugins = {};
        
        Object.defineProperty(this, 'id', {
            get: function () { return this.proxy.Id; },
            set: function (arg) {}
        });
        debug('Device.id: ' + this.id);
        
        Object.defineProperty(this, 'name', {
            get: function () { return this.proxy.Name; },
            set: function (name) { return; }
        });
        debug('Device.name: ' + this.name);
        
        Object.defineProperty(this, 'type', {
            get: function () { return this.proxy.DeviceType; },
            set: function (arg) {}
        });
        debug('Device.type: ' + this.type);
        
        Object.defineProperty(this, 'version', {
            get: function () { return this.proxy.ProtocolVersion; },
            set: function (arg) {}
        });
        debug('Device.version: ' + this.version);
        
        Object.defineProperty(this, 'address', {
            get: function () { return this.proxy.Address; },
            set: function (arg) {}
        });
        debug('Device.address: ' + this.address);
        
        Object.defineProperty(this, 'paired', {
            get: function () { return this.proxy.IsPaired; },
            set: function (arg) {}
        });
        debug('Device.paired: ' + this.paired);
        
        Object.defineProperty(this, 'allowed', {
            get: function () { return this.proxy.Allowed; },
            set: function (arg) { return arg; }
        });
        debug('Device.allowed: ' + this.allowed);
        
        Object.defineProperty(this, 'active', {
            get: function () { return this.proxy.Allowed; },
            set: function (arg) { return arg; }
        });
        debug('Device.active: ' + this.active);
        
        Object.defineProperty(this, 'incomingCapabilities', {
            get: function () { return this.proxy.IncomingCapabilities; },
            set: function (arg) { return; }
        });
        debug('Device.incomingCapabilities: ' + this.incomingCapabilities);
        
        Object.defineProperty(this, 'outgoingCapabilities', {
            get: function () { return this.proxy.OutgoingCapabilities; },
            set: function (arg) { return arg; }
        });
        debug('Device.outgoingCapabilities: ' + this.outgoingCapabilities);
        
        // Plugins
        // TODO: outgoing vs incoming? supported vs enabled reporting?
        for (let pluginName of this.outgoingCapabilities) {
            pluginName = pluginName.substring(11)
            
            if (Plugins.hasOwnProperty(pluginName)) {
                this.plugins[pluginName] = new Plugins[pluginName](this);
            };
        };
    },
    
    destroy: function () {
        // TODO: run through the whole thing
        for (let pluginName in this.plugins) {
            this.plugins[pluginName].destroy();
            delete this.plugins[pluginName];
        };
        
        delete this.proxy;
    }
});

Signals.addSignalMethods(Device.prototype);


// A DBus Interface wrapper for org.mconnect.DeviceManager
const DeviceManager = new Lang.Class({
    Name: 'DeviceManager',
    
    devices: {},
    
    _init: function () {
        // Create proxy wrapper for DBus Interface
        this.proxy = new ManagerProxy(
            Gio.DBus.session,
            'org.mconnect',
            '/org/mconnect/manager'
        );
        
        // Properties
        Object.defineProperty(this, 'name', {
            get: function () {
                // TODO: this is actually a read/write property for KDE Connect
                //       but mconnect always reports username@hostname.
                return GLib.get_user_name() + '@' + GLib.get_host_name();
            }
        });
        debug('DeviceManager.name: ' + this.name);
        
        // Add currently managed devices
        for (let busPath of this._ListDevices()) {
            this._deviceAdded(this, null, busPath);
        };
    },
    
    _deviceAdded: function (manager, signal_id, busPath) {
        debug('Signal Callback: DeviceManager.deviceAdded: ' + busPath);
        
        this.devices[busPath] = new Device(busPath);
        this.emit('device-added', null, busPath);
    },
    
    _deviceRemoved: function (manager, signal_id, busPath) {
        debug('Signal Callback: DeviceManager.deviceRemoved: ' + busPath);
        
        this.devices[busPath].destroy();
        delete this.devices[busPath];
        this.emit('device-removed', null, busPath);
    },
    
    destroy: function () {
        for (let busPath in this.devices) {
            this._deviceRemoved(this, null, busPath);
        };
    },
    
    // Methods: remove the DBus cruft, but otherwise preserved
    _AllowDevice: function (busPath) {
        // Add device at DBus path *busPath*
        return this.proxy.AllowDeviceSync(busPath)[0];
    },
    
    _ListDevices: function () {
        // Return an Array of DBus paths to managed devices
        return this.proxy.ListDevicesSync()[0];
    }
});

Signals.addSignalMethods(DeviceManager.prototype);

