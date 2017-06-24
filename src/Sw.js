"use strict";

// Sw - A series of widgets, extending St

const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const ModalDialog = imports.ui.modalDialog;

//
function hasValue(obj, value) {
    for (let key in obj) {
        if (obj[key] === value) {
            return true;
        }
    }
    
    return false;
}

//
const ButtonsType = {
    NONE: 0,        // no buttons at all
    OK: 1,          // an OK button
    CLOSE: 2,       // a Close button
    CANCEL: 3,      // a Cancel button
    YES_NO: 4,      // Yes and No buttons
    OK_CANCEL: 5,   // OK and Cancel buttons
};

const MessageType = {
    INFO: 0,        // Informational message
    WARNING: 1,     // Non-fatal warning message
    QUESTION: 2,    // Question requiring a choice
    ERROR: 3,       // Fatal error message
    OTHER: 4,       // None of the above
};

const ResponseType = {
    NONE: -1,           // Returned if an action widget has no response id, or
                        // the dialog gets programmatically hidden or destroyed
    REJECT: -2,         // Generic response id, not used by GTK+ dialogs
    ACCEPT: -3,         // Generic response id, not used by GTK+ dialogs
    DELETE_EVENT: -4,   // Returned if the dialog is deleted
    OK: -5,             // Returned by OK buttons in GTK+ dialogs
    CANCEL: -6,         // Returned by Cancel buttons in GTK+ dialogs
    CLOSE: -7,          // Returned by Close buttons in GTK+ dialogs
    YES: -8,            // Returned by Yes buttons in GTK+ dialogs
    NO: -9,             // Returned by No buttons in GTK+ dialogs
    APPLY: -10,         // Returned by Apply buttons in GTK+ dialogs
    HELP: -11,          // Returned by Help buttons in GTK+ dialogs
};

/** 
 * MessageDialog: A rendition of Gtk.MessageDialog for Gnome Shell
 *
 * https://github.com/GNOME/gnome-shell/blob/master/js/ui/modalDialog.js
 *
 */
const MessageDialog = new Lang.Class({
    Name: "MessageDialog",
    Extends: ModalDialog.ModalDialog,
    
    _init: function (params) {
        this.parent({
            styleClass: "end-session-dialog",
            destroyOnClose: params["destroyOnClose"] || true
        });
        
        // Dialog Layout
        this.contentLayout.vertical = false;
        
        // Dialog Icon
        this.icon = new St.Icon({
            style_class: "end-session-dialog-shutdown-icon"
        });
        this.contentLayout.add(this.icon, {});
        
        // Message Layout
        this.messageArea = new St.BoxLayout({
            vertical: true,
            style_class: "end-session-dialog-layout"
        });
        this.contentLayout.add(this.messageArea, {
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START
        });
        
        // Summary (this.text)
        this.subject = new St.Label({
            style_class: "end-session-dialog-subject"
        });
        this.messageArea.add(this.subject);
        
        // Description (this.secondary_text)
        this.description = new St.Label({
            style_class: "end-session-dialog-description"
        });
        this.description.clutter_text.line_wrap = true;
        this.messageArea.add(this.description);
        
        // Params
        Object.defineProperties(this, {
            icon_name: {
                get: () => { return this.icon.icon_name; },
                set: (name) => { this.icon.icon_name = name; }
            },
            
            message_area: {
                value: this.messageArea
            },
            
            text: {
                get: () => { return this.subject.text; },
                set: (text) => { this.subject.text = text; }
            },
            
            secondary_text: {
                get: () => { return this.description.text; },
                set: (text) => { this.description.text = text; }
            },
            
            buttons: {
                get: () => { return null; }, // TODO
                set: (arg) => { this._setButtons(arg); }
            }
        });
        
        // Init the Dialog
        this.message_type = params["message_type"] || MessageType.OTHER;
        
        if (params.hasOwnProperty("icon_name")) {
            this.icon_name = params["icon_name"];
        } else if (this.message_type === MessageType.INFO) {
            this.icon_name = "dialog-information-symbolic";
        } else if (this.message_type === MessageType.WARNING) {
            this.icon_name = "dialog-warning-symbolic";
        } else if (this.message_type === MessageType.QUESTION) {
            this.icon_name = "dialog-question-symbolic";
        } else if (this.message_type === MessageType.ERROR) {
            this.icon_name = "dialog-error-symbolic";
        } else if (this.message_type === MessageType.OTHER) {
            this.icon_name = "dialog-information-symbolic";
        }
        
        this.text = params["text"] || "Information";
        this.secondary_text = params["secondary_text"] || "No description";
        this.buttons = params["buttons"] || ButtonsType.NONE;
    },
    
    _setButtons: function (buttons) {
        if (hasValue(ButtonsType, buttons)) {
            this.addButtonsType(buttons);
        } else if (buttons instanceof Array) {
            buttons.forEach((params) => { this.addButton(params); });
        }
    },
    
    addButton: function (button) {
        ModalDialog.ModalDialog.prototype.addButton.call(this, {
            label: button.text,
            action: () => { this.emit("response", button.response); },
            isDefault: button.isDefault,
            key: button.key
        });
    },
    
    addButtonsType: function (buttonsType = ButtonsType.NONE) {
        switch (buttonsType) {
            case ButtonsType.OK:
                this.addButton({
                    text: "OK",
                    response: ResponseType.OK,
                    isDefault: true
                });
                break;
            case ButtonsType.CLOSE:
                this.addButton({
                    text: "Close",
                    response: ResponseType.CLOSE,
                    isDefault: true
                });
                break;
            case ButtonsType.CANCEL:
                this.addButton({
                    text: "Cancel",
                    response: ResponseType.OK,
                    isDefault: true
                });
                break;
            case ButtonsType.YES_NO:
                this.buttons = [
                    {
                        text: "No",
                        response: ResponseType.NO,
                        isDefault: false,
                        key: Clutter.KEY_Escape
                    },
                    {
                        text: "Yes",
                        response: ResponseType.YES,
                        isDefault: true
                    }
                ];
                break;
            case ButtonsType.OK_CANCEL:
                this.buttons = [
                    {
                        text: "Cancel",
                        response: ResponseType.CANCEL,
                        isDefault: false,
                        key: Clutter.KEY_Escape
                    },
                    {
                        text: "OK",
                        response: ResponseType.OK,
                        isDefault: true
                    }
                ];
                break;
            default:
                // ButtonsType.NONE
                break;
        }
    }
});


