import json
import os
import re

# Load discovered features and config flags
with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_features.json', 'r', encoding='utf-8') as f:
    feat_data = json.load(f)

master_features = sorted(feat_data['master_features'])
subsets_map = feat_data['subsets_map']
checked_in_bundles = feat_data['checked_in_bundles']

with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_config_flags.json', 'r', encoding='utf-8') as f:
    config_flags = json.load(f)

# Read index.html
with open(r'E:\TRADINGVIEW ADVANCED\index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

m_dis = re.search(r'disabled_features\s*:\s*\[(.*?)\]', index_html, re.DOTALL)
index_disabled_features = set(re.findall(r'["\']([a-zA-Z0-9_-]+)["\']', m_dis.group(1))) if m_dis else set()

m_en = re.search(r'enabled_features\s*:\s*\[(.*?)\]', index_html, re.DOTALL)
index_enabled_features = set(re.findall(r'["\']([a-zA-Z0-9_-]+)["\']', m_en.group(1))) if m_en else set()

m_flags = re.search(r'configFlags\s*:\s*\{(.*?)\}', index_html, re.DOTALL)
index_config_flags = {}
if m_flags:
    for line in m_flags.group(1).split('\n'):
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        parts = line.split(':')
        if len(parts) == 2:
            k = parts[0].strip()
            v = parts[1].strip().rstrip(',')
            index_config_flags[k] = v

# Read mt5_broker.js
with open(r'E:\TRADINGVIEW ADVANCED\mt5_broker.js', 'r', encoding='utf-8') as f:
    mt5_code = f.read()

# Categorization sets
TRADING_SET = {
    "order_panel", "order_panel_close_button", "order_panel_undock", "show_order_panel_on_start",
    "trading_terminal", "trading_account_manager", "open_account_manager", "trading_notifications",
    "show_trading_notifications_history", "chart_property_page_trading", "buy_sell_buttons",
    "broker_button", "dom_widget", "show_dom_first_time", "enable_dom_data_for_untradable_symbols",
    "order_info", "always_pass_called_order_to_modify", "chart_crosshair_menu",
    "chart_hide_close_position_button", "chart_hide_close_order_button", "snapshot_trading_drawings",
    "mobile_trading", "real_brokers", "show_symbol_logo_in_account_manager",
    "auto_enable_symbol_labels"
}

DATAFEED_SCALES_SET = {
    "seconds_resolution", "tick_resolution", "custom_resolutions", "pre_post_market_sessions",
    "pre_post_market_price_line", "show_average_close_price_line_and_label", "countdown",
    "display_market_status", "go_to_date", "timeframes_toolbar", "star_some_intervals_by_default",
    "allow_supported_resolutions_set_only", "disable_resolution_rebuild", "update_timeframes_set_on_symbol_resolve",
    "update_study_formatter_on_symbol_resolve", "pay_attention_to_ticker_not_symbol",
    "use_ticker_on_symbol_info_update", "clear_bars_on_series_error", "hide_loading_screen_on_series_error",
    "no_bars_status", "low_density_bars", "end_of_period_timescale_marks", "two_character_bar_marks_labels",
    "bars_marks", "cropped_tick_marks", "fix_left_edge", "request_only_visible_range_on_reset",
    "determine_first_data_request_size_using_visible_range", "lock_visible_time_range_on_resize",
    "shift_visible_range_on_new_bar", "secondary_series_extend_time_scale", "studies_extend_time_scale",
    "align_dwm_bars_to_main_series", "intraday_inactivity_gaps", "clear_price_scale_on_error_or_empty_bars",
    "scales_date_format", "scales_time_hours_format", "pricescale_currency", "pricescale_unit",
    "price_scale_always_last_bar_value", "hide_price_scale_global_last_bar_value",
    "hide_object_tree_and_price_scale_exchange_label", "hide_price_scale_if_all_sources_hidden",
    "currency_menu_disabled", "unit_menu_disabled", "main_series_scale_menu", "chart_property_page_scales",
    "charting_library_single_symbol_request", "extended_extrapolation_limit", "disable_sameinterval_aligning",
    "show_last_price_and_change_only_in_series_legend", "use_last_visible_bar_value_in_legend",
    "use_na_string_for_not_available_values", "aria_crosshair_price_description"
}

CHARTS_STYLES_SET = {
    "japanese_chart_styles", "chart_style_hilo", "chart_style_hilo_last_price", "support_multicharts",
    "additional_multichart_layouts", "header_layouttoggle", "header_screenshot", "header_fullscreen_button",
    "side_toolbar_in_fullscreen_mode", "header_in_fullscreen_mode", "collapsible_header",
    "charting_library_base", "charting_library", "static_charts_service", "tv_production", "widget", "bovespa_widget",
    "border_around_the_chart", "remove_library_container_border", "move_logo_to_main_pane",
    "show_animated_logo", "widget_logo", "link_to_tradingview", "logo_without_link", "logo_always_maximized",
    "adaptive_logo", "chart_scroll", "chart_zoom", "handle_scale", "handle_scroll", "mouse_wheel_scale",
    "pinch_scale", "axis_pressed_mouse_move_scale", "mouse_wheel_scroll", "pressed_mouse_move_scroll",
    "horz_touch_drag_scroll", "vert_touch_drag_scroll", "right_bar_stays_on_scroll",
    "show_zoom_and_move_buttons_on_touch", "no_min_chart_width", "bypass_chart_height_check",
    "chart_content_overrides_by_defaults", "use_overrides_for_overlay", "timezone_menu",
    "hide_legend_by_default", "legend_widget", "edit_buttons_in_legend", "show_hide_button_in_legend",
    "format_button_in_legend", "study_buttons_in_legend", "delete_button_in_legend", "legend_inplace_edit",
    "disable_legend_inplace_symbol_change", "show_symbol_logo_in_legend", "legend_last_day_change",
    "hide_series_legend_item", "hide_study_overlay_legend_item", "hide_study_compare_legend_item",
    "hide_resolution_in_legend", "hide_unresolved_symbols_in_legend", "hide_main_series_symbol_from_indicator_legend",
    "display_legend_on_all_charts", "always_show_legend_values_on_mobile", "property_pages",
    "show_chart_property_page", "chart_property_page", "chart_property_page_right_margin_editor",
    "show_percent_option_for_right_margin", "lock_visible_range_when_adjusting_percentage_right_margin",
    "library_custom_color_themes", "disable_pulse_animation"
}

def get_category(feat):
    if feat in TRADING_SET:
        return "Trading & Execution"
    if feat in DATAFEED_SCALES_SET:
        return "Datafeed & Scales"
    if feat in CHARTS_STYLES_SET:
        return "Charts & Styles"
    return "Watchlist & Tools"

print("Classifier configured successfully.")
