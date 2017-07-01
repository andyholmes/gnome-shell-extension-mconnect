"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug } = Me.imports.lib;


// DBus Constants
const BUS_NAME = "org.mconnect";

const DeviceNode = new Gio.DBusNodeInfo.new_for_xml('\
<node> \
  <interface name="org.freedesktop.DBus.Properties"> \
    <method name="Get"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="out"/> \
    </method> \
    <method name="GetAll"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="a{sv}" name="properties" direction="out"/> \
    </method> \
    <method name="Set"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="in"/> \
    </method> \
    <signal name="PropertiesChanged"> \
      <arg type="s" name="interface_name"/> \
      <arg type="a{sv}" name="changed_properties"/> \
      <arg type="as" name="invalidated_properties"/> \
    </signal> \
  </interface> \
  <interface name="org.mconnect.Device"> \
    <property type="s" name="Id" access="readwrite"/> \
    <property type="s" name="Name" access="readwrite"/> \
    <property type="s" name="DeviceType" access="readwrite"/> \
    <property type="u" name="ProtocolVersion" access="readwrite"/> \
    <property type="s" name="Address" access="readwrite"/> \
    <property type="b" name="IsPaired" access="readwrite"/> \
    <property type="b" name="Allowed" access="readwrite"/> \
    <property type="b" name="IsActive" access="readwrite"/> \
    <property type="b" name="IsConnected" access="readwrite"/> \
    <property type="as" name="IncomingCapabilities" access="readwrite"/> \
    <property type="as" name="OutgoingCapabilities" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Battery"> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');

DeviceNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });


const ManagerNode = new Gio.DBusNodeInfo.new_for_xml('\
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

ManagerNode.nodes.forEach((nodeInfo) => { nodeInfo.cache_build(); });

// FIXME: unecessary and cludgy
const Interface = {
    DEVICE: DeviceNode.interfaces[1],
    BATTERY: DeviceNode.interfaces[2],
    PING: DeviceNode.interfaces[3],
    FINDMYPHONE: DeviceNode.interfaces[3], // TODO: not actually supported
    SMS: DeviceNode.interfaces[3], // TODO: not actually supported
    MANAGER: ManagerNode.interfaces[0]
};


// Start the backend daemon
function startDaemon() {
    debug("spawning mconnect daemon");
    
    try {
        GLib.spawn_command_line_async("mconnect -d");
        GLib.usleep(10000); // 10ms TODO: still need this?
    } catch (e) {
        debug("mconnect.startDaemon(): " + e);
    }
}


// Open the extension preferences window
function startPreferences() {
    debug("spawning mconnect settings");
    
    try {
        GLib.spawn_command_line_async(
            "gnome-shell-extension-prefs mconnect@andyholmes.github.io"
        );
    } catch (e) {
        debug("mconnect.startSettings(): " + e);
    }
}


const ProxyBase = new Lang.Class({
    Name: "ProxyBase",
    Extends: Gio.DBusProxy,
    Signals: {
        "received": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_VARIANT ]
        },
        "changed": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_VARIANT ]
        }
    },
    
    _init: function (iface, dbusPath) {
        this.parent({
            gConnection: Gio.DBus.session,
            gInterfaceInfo: iface,
            gName: BUS_NAME,
            gObjectPath: dbusPath,
            gInterfaceName: iface.name
        });
        
        this._signals = [];
        this.cancellable = new Gio.Cancellable();
        this.init(null);
    },
    
    // Wrapper functions
    _call: function (name, variant, callback) {
        // TODO: check this
        debug("mconnect.ProxyBase._call(" + name + ")");
        
        let ret;
        
        if (typeof callback === "function" || callback === true) {
            this.call(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (proxy, result) => {
                    try {
                        ret = this.call_finish(result);
                        
                        if (typeof callback === "function") {
                            callback(ret);
                        }
                    } catch (e) {
                        log("Error calling " + name + ": " + e.message);
                    }
                }
            );
        } else {
            ret = this.call_sync(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                this.cancellable
            );
        }
        
        return (ret) ? ret.deep_unpack()[0] : null;
    },
    
    _get: function (name) {
        debug("mconnect.ProxyBase._get(" + name + ")");
        
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },

    _set: function (name, value, signature) {
        // TODO: simplify this (and use it)
        debug("mconnect.ProxyBase._set(" + name + ")");
        
        let variant = new GLib.Variant(signature, value);
        this.set_cached_property(name, variant);

        this.call(
            "org.freedesktop.DBus.Properties.Set",
            new GLib.Variant("(ssv)", [this.gInterfaceName, name, variant]),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable,
            (proxy, result) => {
                try {
                    this.call_finish(result);
                } catch (e) {
                    log("Error setting " + name + " on " + this.gObjectPath +
                        ": " + e.message
                    );
                }
            }
        );
    },
    
    /**
     * _wrapProperties:
     *
     * ...
     */
    _wrapProperties: function () {
        // Properties
        debug("mconnect.ProxyBase._wrapProperties()");
        
        this.gInterfaceInfo.properties.forEach((property) => {
            // Homogenize property names
            let name = property.name.replace("Is", "");
            name = name.replace("Device", "").toCamelCase();
            
            Object.defineProperty(this, name, {
                get: Lang.bind(this, this._get, property.name),
                // TODO: not ready for prime-time
                //set: Lang.bind(this, _propertySetter, name, signature),
                configurable: true,
                enumerable: true
            });
        });
    },
    
    /**
     * _wrapPropertiesChanged:
     * @emitter: The object to have emit the signal. Defaults to "this".
     *
     * PropertiesChanged...
     */
    _wrapPropertiesChanged: function (emitter) {
        debug("mconnect.ProxyBase._wrapPropertiesChanged()");
        
        emitter = (emitter === undefined) ? this : emitter;
        
        this._signals.push(
            this.connect("g-properties-changed", (proxy, properties) => {
                properties = properties.deep_unpack();
                
                for (let name in properties) {
                    let property = name.replace("Is", "");
                    property = property.replace("Device", "").toCamelCase();
                    
                    emitter.emit("changed::" + property, properties[name]);
                }
            })
        );
    },
    
    /**
     * _wrapSignals:
     * @emitter: The object to have emit the signal. Defaults to "this".
     *
     * Connect to "g-signal" and re-emit each encapsulated signal via @emitter.
     */
    _wrapSignals: function (emitter) {
        // Wrap signals
        // FIXME: case
        debug("mconnect.ProxyBase._wrapSignals()");
        
        emitter = (emitter === undefined) ? this : emitter;
        
        this._signals.push(
            this.connect("g-signal", (proxy, sender, name, parameters) => {
                emitter.emit("received::" + name.toCamelCase(), parameters);
            })
        );
    },
    
    // Override as needed
    destroy: function () {
        this._signals.forEach((signal) => { this.disconnect(signal); });
    }
});


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    Extends: ProxyBase,
    
    _init: function (dbusPath) {
        this.parent(Interface.DEVICE, dbusPath);
        
        // Wrap "g-properties-changed"
        this._wrapProperties();
        this._wrapPropertiesChanged();
        
        // Plugins
        this.connect("changed::incomingCapabilities", () => {
            this._pluginsChanged()
        });
        this.connect("changed::outgoingCapabilities", () => {
            this._pluginsChanged()
        });
        
        //
        this._pluginsChanged();
    },
    
    // Callbacks
    _pluginsChanged: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        debug("mconnect.Device._pluginsChanged()");
        
        //FIXME: mad cludgy
        let _plugins = {
            battery: false,
            ping: false,
            findmyphone: false,
            sms: false
        };
        
        // Device has gone inactive 
        if (!this.active) {
            for (let plugin in _plugins) {
                if (this.hasOwnProperty(plugin)) {
                    this[plugin].destroy();
                    delete this[plugin];
                }
            }
            
            return;
        }
        
        this.outgoingCapabilities.forEach((plugin) => {
            if (plugin === "kdeconnect.battery") { _plugins.battery = true; }
            if (plugin === "kdeconnect.ping") { _plugins.ping = true; }
        });
        
        this.incomingCapabilities.forEach((plugin) => {
            if (plugin === "kdeconnect.findmyphone.request") {
                _plugins.findmyphone = true;
            }
            if (plugin === "kdeconnect.sms.request") { _plugins.sms = true; }
        });
        
        for (let plugin in _plugins) {
            if (_plugins[plugin] === true) {
                this[plugin] = new ProxyBase(
                    Interface[plugin.toUpperCase()],
                    this.gObjectPath
                );
                
                // Battery Plugin
                if (plugin === "battery") {
                    this.battery._wrapProperties();
                    this.battery._wrapPropertiesChanged();
        
                    // Re-wrap changed::charging/level as changed::battery
                    this.battery.connect("changed::charging", (proxy, variant) => {
                        this.emit("changed::battery",
                            new GLib.Variant(
                                "(bu)",
                                [variant.deep_unpack(), this.battery.level]
                            )
                        );
                    });
                    
                    this.battery.connect("changed::level", (proxy, variant) => {
                        this.emit("changed::battery",
                            new GLib.Variant(
                                "(bu)",
                                [this.battery.charging, variant.deep_unpack()]
                            )
                        );
                    });
                    
                    this.emit("changed::battery",
                        new GLib.Variant(
                            "(bu)",
                            [this.battery.charging, this.battery.level]
                        )
                    );
                    
                } else if (plugin === "ping") {
                    this[plugin]._wrapSignals(this);
                }
            } else {
                this[plugin].destroy();
                delete this[plugin];
            }
        }
        
        this.emit("changed::plugins", new GLib.Variant("()", ""));
    },
    
    // Plugin Methods
    ping: function () {
        // TODO
        debug("mconnect.Device.ping(): Not Implemented");
    },
    
    ring: function () {
        // TODO
        debug("mconnect.Device.ring(): Not Implemented");
    },
    
    sendSMS: function (number, message) {
        // TODO
        debug("mconnect.Device.sendSMS(): Not Implemented");
    },
    
    // Override Methods
    destroy: function () {
        ["battery", "findmyphone", "ping", "sms"].forEach((plugin) => {
            if (this.hasOwnProperty(plugin)) {
                this[plugin].destroy();
                delete this[plugin];
            }
        });
        
        ProxyBase.prototype.destroy.call(this);
    }
});


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    Extends: ProxyBase,
    Signals: {
        "device": {
            flags: GObject.SignalFlags.RUN_FIRST | GObject.SignalFlags.DETAILED,
            param_types: [ GObject.TYPE_STRING ]
        }
    },
    
    _init: function () {
        this.parent(Interface.MANAGER, "/org/mconnect/manager");
        
        // Track our device proxies, DBus path as key
        this.devices = {};
        
        // Properties
        Object.defineProperties(this, {
            name: {
                get: function () {
                    // TODO: this is actually a read/write property for KDE
                    // Connect but MConnect always reports username@hostname
                    return GLib.get_user_name() + "@" + GLib.get_host_name();
                }
            }
        });
        
        // Add currently managed devices
        this.listDevices().forEach((dbusPath) => {
            this._deviceAdded(this, dbusPath);
        });
    },
    
    // Callbacks
    _deviceAdded: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceAdded(" + dbusPath + ")");
        
        this.devices[dbusPath] = new Device(dbusPath);
        this.emit("device::added", dbusPath);
    },
    
    _deviceRemoved: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceRemoved(" + dbusPath + ")");
        
        this.devices[dbusPath].destroy();
        delete this.devices[dbusPath];
        this.emit("device::removed", dbusPath);
    },
    
    // Methods
    allowDevice: function (dbusPath) {
        // Mark the device at *dbusPath* as allowed
        debug("mconnect.DeviceManager.allowDevice(" + dbusPath + ")");
        
        this._call("AllowDevice", new GLib.Variant("(s)", [dbusPath]), true);
    },
    
    disallowDevice: function (dbusPath) {
        // TODO: not a method yet
        // Unmark the device at *dbusPath* as unallowed
        debug("mconnect.DeviceManager.disallowDevice(" + dbusPath + ")");
        debug("mconnect.DeviceManager.disallowDevice(): Not Implemented")
    },
    
    listDevices: function () {
        debug("mconnect.DeviceManager.listDevices()");
        
        return this._call("ListDevices", new GLib.Variant("()", ""));
    },
    
    // Override Methods
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
    }
});

