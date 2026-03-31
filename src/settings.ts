"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

class ButtonSettingsCard extends FormattingSettingsCard {
    buttonText = new formattingSettings.TextInput({
        name: "buttonText",
        displayName: "ボタンテキスト",
        placeholder: "値をコピー",
        value: "値をコピー",
    });

    backgroundColor = new formattingSettings.ColorPicker({
        name: "backgroundColor",
        displayName: "ボタン背景色",
        value: { value: "#0078d4" },
    });

    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "ボタン文字色",
        value: { value: "#ffffff" },
    });

    name = "buttonSettings";
    displayName = "ボタン設定";
    slices: Array<FormattingSettingsSlice> = [
        this.buttonText,
        this.backgroundColor,
        this.fontColor,
    ];
}

class DisplaySettingsCard extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "フォントサイズ",
        value: 14,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 10 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 32 } },
    });

    separator = new formattingSettings.ItemDropdown({
        name: "separator",
        displayName: "区切り文字",
        items: [
            { displayName: "タブ", value: "tab" },
            { displayName: "カンマ", value: "comma" },
            { displayName: "パイプ", value: "pipe" },
        ],
        value: { displayName: "タブ", value: "tab" },
    });

    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "値を表示する",
        value: true,
    });

    copyColumnName = new formattingSettings.ItemDropdown({
        name: "copyColumnName",
        displayName: "コピーする列",
        items: [{ displayName: "全列", value: "" }],
        value: { displayName: "全列", value: "" },
    });

    name = "displaySettings";
    displayName = "表示設定";
    slices: Array<FormattingSettingsSlice> = [
        this.fontSize,
        this.separator,
        this.showValues,
        this.copyColumnName,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    buttonSettings = new ButtonSettingsCard();
    displaySettings = new DisplaySettingsCard();
    cards = [this.buttonSettings, this.displaySettings];
}
