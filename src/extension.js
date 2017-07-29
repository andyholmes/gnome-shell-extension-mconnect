"use strict";

// Imports
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.lib;
const MConnect = Me.imports.mconnect;
const KDEConnect = Me.imports.kdeconnect;

// Module Constants
const ServiceBackend = {
    MCONNECT: 0,
    KDECONNECT: 1
};

const DeviceVisibility = {
    OFFLINE: 1,
    UNPAIRED: 2,
    RESERVED: 4
};

/** Composite Widgets */

// A PopupMenu used as an information and control center for a device,
// accessible either as a User Menu submenu or Indicator popup-menu.
const DeviceMenu = new Lang.Class({
    Name: "DeviceMenu",
    Extends: PopupMenu.PopupMenuSection,

    _init: function (device) {
        this.parent();

        this.device = device;

        // Info Bar
        this.infoBar = new PopupMenu.PopupSeparatorMenuItem(device.name);
        this.infoBar.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.addMenuItem(this.infoBar);
        
        // InfoBar -> Battery label (eg. "85%")
        this.batteryLabel = new St.Label();
        this.batteryLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.infoBar.actor.add(this.batteryLabel);
        
        // Info Bar -> Battery Icon (eg. battery-good-symbolic)
        this.batteryIcon = new St.Icon({
            icon_name: "battery-missing-symbolic",
            style_class: "popup-menu-icon"
        });
        this.infoBar.actor.add(this.batteryIcon);
        
        // Status Bar
        this.statusBar = new PopupMenu.PopupMenuSection({
            reactive: false,
            can_focus: false,
            vertical: false
        });
        this.addMenuItem(this.statusBar);
        
        // Status Content
        this.statusBar.statusContent = new St.BoxLayout({
            vertical: false,
            style_class: "popup-menu-item"
        });
        this.statusBar.actor.add(this.statusBar.statusContent);
        
        // Status Content -> Icon
        this.statusBar.statusContent.add(
            new St.Icon({
                icon_name: "channel-insecure-symbolic",
                icon_size: 24
            })
        );
        // Status Content -> Label
        this.statusBar.label = new St.Label({
            text: "",
            style: "margin: 1em;"
        });
        this.statusBar.label.clutter_text.line_wrap = true;
        this.statusBar.statusContent.add(this.statusBar.label);
        
        // Status Bar -> Pair Button
        this.statusBar.button = new PopupMenu.PopupMenuItem(_("Send pair request"))
        this.statusBar.button.label.x_expand = true;
        this.statusBar.button.label.x_align = Clutter.ActorAlign.CENTER;
        this.statusBar.button.connect("activate", (item) => {
            (device.trusted) ? device.unpair() : device.pair();
        });
        this.statusBar.addMenuItem(this.statusBar.button);

        // Action Bar
        this.actionBar = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        }); 
        this.addMenuItem(this.actionBar);

        this.smsButton = this._addActionButton(
            "user-available-symbolic",
            Lang.bind(this, this._smsAction)
        );
        this.findButton = this._addActionButton(
            "find-location-symbolic",
            Lang.bind(this, this._findAction)
        );
        this.browseButton = this._addActionButton(
            "folder-remote-symbolic",
            Lang.bind(this, this._browseAction)
        );
        this.shareButton = this._addActionButton(
            "send-to-symbolic",
            Lang.bind(this, this._shareAction)
        );

        // Property signals
        device.connect(
            "changed::battery",
            Lang.bind(this, this._batteryChanged)
        );
        device.connect(
            "notify::name",
            Lang.bind(this, this._nameChanged)
        );
        device.connect(
            "changed::plugins",
            Lang.bind(this, this._pluginsChanged)
        );
        
        // Device Status Properties
        ["reachable", "trusted"].forEach((property) => {
            device.connect(
                "notify::" + property,
                Lang.bind(this, this._stateChanged)
            );
        });
        // TODO: MConnect doesn't call PropertiesChanged on cached devices?
        this._stateChanged(device);
        
        // Device Visibility Settings
        ["device-visibility"].forEach((setting) => {
            Settings.connect(
                "changed::device-visibility",
                Lang.bind(this, this._settingsChanged)
            )
        });
        this._settingsChanged();
    },

    _addActionButton: function (name, callback) {
        let button = new St.Button({ style_class: "system-menu-action" });
        button.child = new St.Icon({ icon_name: name });
        button.style = "padding: 8px;";
        button.connect("clicked", callback);

        this.actionBar.actor.add(button, { expand: true, x_fill: false });
        
        return button;
    },

    // Callbacks
    _batteryChanged: function (device, variant) {
        debug("extension.DeviceMenu._batteryChanged(" + variant.deep_unpack() + ")");
        
        let [charging, level] = variant.deep_unpack();
        let icon = "battery";

        if (level < 3) {
            icon += charging ? "-empty-charging" : "-empty";
        } else if (level < 10) {
            icon += charging ? "-caution-charging" : "-caution";
        } else if (level < 30) {
            icon += charging ? "-low-charging" : "-low";
        } else if (level < 60) {
            icon += charging ? "-good-charging" : "-good";
        } else if (level >= 60) {
            icon += charging ? "-full-charging" : "-full";
        }

        this.batteryIcon.icon_name = icon + "-symbolic";
        this.batteryLabel.text = level + "%";
    },

    _nameChanged: function (device, name) {
        debug("extension.DeviceMenu._nameChanged()");
        
        name = name.deep_unpack();
        this.nameLabel.label.text = (name === "string") ? name : device.name;
    },

    _pluginsChanged: function (device, plugins) {
        debug("extension.DeviceMenu._pluginsChanged()");

        // Device Menu Buttons
        let buttons = {
            browse: this.browseButton,
            findmyphone: this.findButton,
            share: this.shareButton,
            telephony: this.smsButton
        };
        let sensitive;

        for (let name in buttons) {
            sensitive = (device.hasOwnProperty(name));
            buttons[name].can_focus = sensitive;
            buttons[name].reactive = sensitive;
            buttons[name].track_hover = sensitive;
            buttons[name].opacity = sensitive ? 255 : 128;
        }
        
        // Battery plugin disabled/unallowed
        if (device.trusted && device.hasOwnProperty("battery")) {
            this.batteryIcon.visible = true;
            
            this._batteryChanged(
                device,
                new GLib.Variant(
                    "(bi)",
                    [device.battery.charging, device.battery.level]
                )
            );
        } else {
            this.batteryIcon.visible = false;
            this.batteryLabel.text = "";
        }
    },

    _settingsChanged: function () {
        debug("extension.DeviceMenu._settingsChanged()");
        
        let { reachable, trusted } = this.device;
        let flags = Settings.get_flags("device-visibility");
        
        // FIXME: kind of confusing settings
        if (!(flags & DeviceVisibility.UNPAIRED) && !trusted) {
            this.actor.visible = false;
        } else if (!(flags & DeviceVisibility.OFFLINE) && !reachable) {
            this.actor.visible = false;
        } else {
            this.actor.visible = true;
        }
    },

    _stateChanged: function (device, state) {
        debug("extension.DeviceMenu._stateChanged(" + this.device.gObjectPath + ")");
        
        let { reachable, trusted } = this.device;
        
        this.actionBar.actor.visible = (reachable && trusted);
        this.statusBar.actor.visible = (!reachable || !trusted);
        this.statusBar.button.actor.visible = (reachable && !trusted);
        
        if (!trusted) {
            this.statusBar.label.text = _("This device is unpaired");
        } else if (!reachable) {
            this.statusBar.label.text = _("Device is offline");
        }
        
        this._pluginsChanged(this.device);
    },

    // Plugin Callbacks
    _browseAction: function (button) {
        debug("extension.DeviceMenu._browseAction(): Not Implemented");
        
        this._getTopMenu().close(true);
    },

    _findAction: function (button) {
        debug("extension.DeviceMenu._findAction()");
        this._getTopMenu().close(true);
        this.device.ring();
    },

    _shareAction: function (button) {
        debug("extension.DeviceMenu._shareAction()");
        
        this._getTopMenu().close(true);
        
        let [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(
            GLib.getenv('HOME'),            // working dir
            ["gjs", Me.path + "/share.js"], // argv
            null,                           // envp
            GLib.SpawnFlags.SEARCH_PATH,    // enables PATH
            null                            // child_setup (func)
        );

        let stdout = new Gio.DataInputStream({
            base_stream: new Gio.UnixInputStream({ fd: out_fd })
        });

        stdout.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
            let [filePath, length] = stdout.read_line_finish(res);
    
            if (filePath && filePath.toString() !== null) {
                this.device.shareURI(filePath.toString());
            }
        });
    },

    _smsAction: function (button) {
        debug("extension.DeviceMenu._smsAction()");
        
        this._getTopMenu().close(true);
        
        GLib.spawn_command_line_async(
            "gjs " + Me.path + "/sms.js \"" + this.device.gObjectPath + "\""
        );
    }
});

Signals.addSignalMethods(DeviceMenu.prototype);

/**
 * An indicator representing a device in Menu.panel.statusArea, used as an
 * optional location for a DeviceMenu.
 */
const DeviceIndicator = new Lang.Class({
    Name: "DeviceIndicator",
    Extends: PanelMenu.Button,

    _init: function (device) {
        this.parent(null, device.name + " Indicator", false);

        this.device = device;

        // Device Icon
        this.icon = new St.Icon({
            icon_name: "smartphone-disconnected",
            style_class: "system-status-icon"
        });
        this.actor.add_actor(this.icon);

        this.deviceMenu = new DeviceMenu(device);
        this.menu.addMenuItem(this.deviceMenu);

        // Signals
        ["device-indicators", "device-visibility"].forEach((setting) => {
            Settings.connect("changed::" + setting, () => { this._sync(); });
        });
        
        ["reachable", "trusted"].forEach((property) => {
            device.connect("notify::" + property, () => { this._sync(); });
        });

        // Sync
        this._sync(device);
    },

    // Callbacks
    _sync: function (sender, cb_data) {
        debug("extension.DeviceIndicator._sync()");

        // Device Visibility
        let flags = Settings.get_flags("device-visibility");
        
        if (!(flags & DeviceVisibility.UNPAIRED) && !this.device.trusted) {
            this.actor.visible = false;
        } else if (!(flags & DeviceVisibility.OFFLINE) && !this.device.reachable) {
            this.actor.visible = false;
        } else {
            this.actor.visible = true;
        }

        // Indicator Visibility (User Setting)
        if (this.actor.visible) {
            this.actor.visible = Settings.get_boolean("device-indicators");
        }

        // Indicator Icon
        let icon = this.device.type;
        icon = (icon === "phone") ? "smartphone" : icon;

        if (this.device.trusted && this.device.reachable) {
            this.icon.icon_name = icon + "-connected";
        } else if (this.device.trusted) {
            this.icon.icon_name = icon + "-trusted";
        } else {
            this.icon.icon_name = icon + "-disconnected";
        }
    },
    
    destroy: function () {
        this.deviceMenu.destroy();
        delete this.deviceMenu;
        PanelMenu.Button.prototype.destroy.call(this);
    }
});

// The main extension hub.
const SystemIndicator = new Lang.Class({
    Name: "SystemIndicator",
    Extends: PanelMenu.SystemIndicator,

    _init: function () {
        this.parent();

        this.manager = false;
        
        // Select the backend service
        if (Settings.get_enum("service-backend") === ServiceBackend.MCONNECT) {
            this._backend = MConnect;
        } else {
            this._backend = KDEConnect;
        }

        // device submenus
        this.deviceMenus = {};

        // System Indicator
        this.extensionIndicator = this._addIndicator();
        this.extensionIndicator.icon_name = "smartphone-symbolic";
        let userMenuTray = Main.panel.statusArea.aggregateMenu._indicators;
        userMenuTray.insert_child_at_index(this.indicators, 0);

        // Extension Menu
        this.extensionMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("Mobile Devices"),
            true
        );
        this.extensionMenu.icon.icon_name = "smartphone-symbolic";
        this.menu.addMenuItem(this.extensionMenu);

        // Extension Menu -> Devices Section -> [ DeviceMenu, ... ]
        this.devicesSection = new PopupMenu.PopupMenuSection();
        this.extensionMenu.menu.addMenuItem(this.devicesSection);

        // Extension Menu -> [ Enable Item ]
        this.enableItem = this.extensionMenu.menu.addAction(
            _("Enable"),
            this._backend.startService
        );

        // Extension Menu -> Mobile Settings Item
        this.extensionMenu.menu.addAction(
            _("Mobile Settings"),
            this._backend.startPreferences
        );

        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);

        // Watch "device-indicators" setting
        Settings.connect(
            "changed::device-indicators",
            Lang.bind(this, this._sync)
        );

        // Watch for DBus service
        this._watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            this._backend.BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._serviceAppeared),
            Lang.bind(this, this._serviceVanished)
        );

        // Watch "service-autostart" setting
        Settings.connect("changed::service-autostart", (settings, key) => {
            if (Settings.get_boolean(key) && this.manager === null) {
                this._backend.startService();
            }
        });
    },

    // UI Settings callbacks
    _sync: function () {
        debug("extension.SystemIndicator._sync()");

        // Show "Enable" if backend not running
        this.enableItem.actor.visible = (this.manager) ? false : true;

        // Show per-device indicators OR user menu entries
        if (Settings.get_boolean("device-indicators")) {
            this.devicesSection.actor.visible = false;
        } else {
            this.devicesSection.actor.visible = true;
        }
    },

    // DBus Callbacks
    _serviceAppeared: function (conn, name, name_owner, cb_data) {
        // The DBus interface has appeared
        debug("extension.SystemIndicator._serviceAppeared()");
        
        this.manager = new this._backend.DeviceManager();

        for (let dbusPath in this.manager.devices) {
            systemIndicator._deviceAdded(this.manager, null, dbusPath);
        }

        // Sync the UI
        this._sync();

        // Watch for new and removed devices
        this.manager.connect(
            "device::added",
            Lang.bind(this, this._deviceAdded)
        );

        this.manager.connect(
            "device::removed",
            Lang.bind(this, this._deviceRemoved)
        );
    },

    _serviceVanished: function (conn, name, name_owner, cb_data) {
        // The DBus interface has vanished
        debug("extension.SystemIndicator._serviceVanished()");

        // If a manager is initialized, destroy it
        if (this.manager) {
            this.manager.destroy();
            this.manager = false;
        }

        // Sync the UI
        this._sync();

        // Start the service or wait for it to start
        if (Settings.get_boolean("service-autostart")) {
            this._backend.startService();
        } else {
            log("waiting for service");
        }
    },

    _deviceAdded: function (manager, detail, dbusPath) {
        debug("extension.SystemIndicator._deviceAdded(" + dbusPath + ")");

        let device = this.manager.devices[dbusPath];

        // Per-device indicator
        let indicator = new DeviceIndicator(device);
        Main.panel.addToStatusArea(dbusPath, indicator);

        // User menu entry
        this.deviceMenus[dbusPath] = new DeviceMenu(device);
        this.devicesSection.addMenuItem(this.deviceMenus[dbusPath]);
    },

    _deviceRemoved: function (manager, dbusPath) {
        // FIXME: not detail on device::removed?
        debug("extension.SystemIndicator._deviceRemoved(" + dbusPath + ")");
        
        // Per-device indicator
        Main.panel.statusArea[dbusPath].destroy();

        // User menu entry
        this.deviceMenus[dbusPath].destroy();
        delete this.deviceMenus[dbusPath]
    },

    // Public Methods
    destroy: function () {
        this.manager.destroy();
        delete this.manager;
        
        // There should be matching deviceMenus and deviceIndicators
        for (let dbusPath in this.deviceMenus) {
            // Indicators
            Main.panel.statusArea[dbusPath].destroy();
            // Menus
            this.deviceMenus[dbusPath].destroy();
            delete this.deviceMenus[dbusPath]
        }

        // Destroy the UI
        this.devicesSection.destroy();
        this.extensionMenu.destroy();
        this.extensionIndicator.destroy();
        this.menu.destroy();

        // Stop watching "service-autostart" & DBus
        // TODO: instance '0x55ff988e3920' has no handler with id '9223372036854775808'
        //Settings.disconnect("changed::service-autostart");

        // Stop watching for DBus Service
        Gio.bus_unwatch_name(this._watchdog);
        
        this.indicators.destroy();
    }
});

var systemIndicator;

function init() {
    debug("initializing extension");
    
    Me.imports.lib.initTranslations();
}

function enable() {
    debug("enabling extension");

    // Create the UI
    systemIndicator = new SystemIndicator();
    
    Settings.connect("changed::service-backend", () => {
        systemIndicator.destroy();
        systemIndicator = new SystemIndicator();
    });
}

function disable() {
    debug("disabling extension");

    // Destroy the UI
    systemIndicator.destroy();
}
