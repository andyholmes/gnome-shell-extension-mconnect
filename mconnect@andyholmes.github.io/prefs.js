// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, getSettings } = Me.imports.utils;


const Preferences = new Lang.Class({
    Name: 'mconnect.Preferences',

    _init: function() {
        this._settings = getSettings('org.gnome.shell.extensions.mconnect');

        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/prefs.ui');

        this.widget = this._builder.get_object('settings_notebook');

        this._bindSettings();

        this._builder.connect_signals_full(Lang.bind(this, this._connector));
    },

    /**
     * Connect signals
     */
    _connector: function(builder, object, signal, handler) {
        object.connect(signal, Lang.bind(this, this._SignalHandler[handler]));
    },

    _bindSettings: function() {
        // Behavior panel
        this._settings.bind('start-daemon',
                            this._builder.get_object('start_daemon'),
                            'active',
                            Gio.SettingsBindFlags.DEFAULT);
                            
        this._settings.bind('wait-daemon',
                            this._builder.get_object('wait_daemon'),
                            'active',
                            Gio.SettingsBindFlags.DEFAULT);

        // About Panel
        this._builder.get_object('extension_version').set_label(Me.metadata.version.toString());
    },

    /**
     * Object containing all signals defined in the glade file
     */
    _SignalHandler: {
        position_top_button_toggled_cb: function(button) {
            //
        }
    }
});

function init() {
    //
};

function buildPrefsWidget() {
    let prefs = new Preferences();
    let widget = prefs.widget;
    widget.show_all();
    return widget;
};
