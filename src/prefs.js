"use strict";

const Lang = imports.lang;
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { initTranslations, AboutDialog, SettingsWidget, Settings } = Me.imports.lib;


function init() {
    initTranslations();
}

// Extension Preferences
function buildPrefsWidget() {
    let widget = new SettingsWidget();
    
    let ifaceSection = widget.add_section(_("Interface"));
    widget.add_setting(ifaceSection, "device-visibility");
    
    let desktopSection = widget.add_section(_("Service"));
    ["service-autostart",
    "service-backend"].forEach((option) => {
        widget.add_setting(desktopSection, option);
    });
    
    let develSection = widget.add_section(_("Development"));
    widget.add_setting(develSection, "debug");
    
    widget.show_all();
    return widget;
}

