import json
import os
import re

with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_features.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data['master_features']
subsets_map = data['subsets_map']
checked_in_bundles = data['checked_in_bundles']

bundle_dir = r'E:\TRADINGVIEW ADVANCED\charting_library\bundles'

# Let's categorize features systematically
# 1. Trading & Execution:
#    order_panel, buy_sell_buttons, trading_account_manager, trading_terminal, trading_notifications,
#    dom_widget, show_dom_first_time, enable_dom_data_for_untradable_symbols, open_account_manager,
#    broker_button, order_info, always_pass_called_order_to_modify, chart_crosshair_menu,
#    chart_property_page_trading, chart_hide_close_position_button, chart_hide_close_order_button,
#    snapshot_trading_drawings, mobile_trading, real_brokers, show_order_panel_on_start,
#    show_trading_notifications_history, order_panel_close_button, order_panel_undock,
#    show_symbol_logo_in_account_manager, etc.

# 2. Datafeed & Scales:
#    seconds_resolution, tick_resolution, custom_resolutions, pre_post_market_sessions,
#    pre_post_market_price_line, show_average_close_price_line_and_label, countdown,
#    display_market_status, go_to_date, timeframes_toolbar, star_some_intervals_by_default,
#    allow_supported_resolutions_set_only, disable_resolution_rebuild, update_timeframes_set_on_symbol_resolve,
#    update_study_formatter_on_symbol_resolve, pay_attention_to_ticker_not_symbol,
#    use_ticker_on_symbol_info_update, clear_bars_on_series_error, hide_loading_screen_on_series_error,
#    no_bars_status, low_density_bars, end_of_period_timescale_marks, two_character_bar_marks_labels,
#    bars_marks, cropped_tick_marks, fix_left_edge, request_only_visible_range_on_reset,
#    determine_first_data_request_size_using_visible_range, lock_visible_time_range_on_resize,
#    shift_visible_range_on_new_bar, secondary_series_extend_time_scale, studies_extend_time_scale,
#    align_dwm_bars_to_main_series, intraday_inactivity_gaps, clear_price_scale_on_error_or_empty_bars,
#    scales_date_format, scales_time_hours_format, pricescale_currency, pricescale_unit,
#    price_scale_always_last_bar_value, hide_price_scale_global_last_bar_value,
#    hide_object_tree_and_price_scale_exchange_label, hide_price_scale_if_all_sources_hidden,
#    currency_menu_disabled, unit_menu_disabled, main_series_scale_menu, chart_property_page_scales, etc.

# 3. Charts & Styles:
#    japanese_chart_styles, chart_style_hilo, chart_style_hilo_last_price, support_multicharts,
#    additional_multichart_layouts, header_layouttoggle, header_screenshot, header_fullscreen_button,
#    side_toolbar_in_fullscreen_mode, header_in_fullscreen_mode, collapsible_header,
#    charting_library_base, charting_library, static_charts_service, tv_production, widget, bovespa_widget,
#    border_around_the_chart, remove_library_container_border, move_logo_to_main_pane,
#    show_animated_logo, widget_logo, link_to_tradingview, logo_without_link, logo_always_maximized,
#    adaptive_logo, chart_scroll, chart_zoom, handle_scale, handle_scroll, mouse_wheel_scale,
#    pinch_scale, axis_pressed_mouse_move_scale, mouse_wheel_scroll, pressed_mouse_move_scroll,
#    horz_touch_drag_scroll, vert_touch_drag_scroll, right_bar_stays_on_scroll,
#    show_zoom_and_move_buttons_on_touch, no_min_chart_width, bypass_chart_height_check,
#    disable_sameinterval_aligning, chart_content_overrides_by_defaults, use_overrides_for_overlay,
#    timezone_menu, hide_legend_by_default, legend_widget, edit_buttons_in_legend,
#    show_hide_button_in_legend, format_button_in_legend, study_buttons_in_legend,
#    delete_button_in_legend, legend_inplace_edit, disable_legend_inplace_symbol_change,
#    show_symbol_logo_in_legend, show_last_price_and_change_only_in_series_legend,
#    legend_last_day_change, use_last_visible_bar_value_in_legend, hide_series_legend_item,
#    hide_study_overlay_legend_item, hide_study_compare_legend_item, hide_resolution_in_legend,
#    hide_unresolved_symbols_in_legend, hide_main_series_symbol_from_indicator_legend,
#    display_legend_on_all_charts, always_show_legend_values_on_mobile,
#    property_pages, show_chart_property_page, chart_property_page,
#    chart_property_page_right_margin_editor, show_percent_option_for_right_margin,
#    lock_visible_range_when_adjusting_percentage_right_margin, etc.

# 4. Watchlist & Tools:
#    multiple_watchlists, watchlist_import_export, watchlist_sections, watchlist_context_menu,
#    watchlist_cross_tab_sync, add_to_watchlist, show_saved_watchlists, watchlists_from_to_file,
#    marked_symbols, fundamental_widget, options_details_widget, show_object_tree,
#    keep_object_tree_widget_in_right_toolbar, object_tree_legend_mode, objects_tree_context_menu,
#    test_show_object_tree_debug, study_templates, drawing_templates, items_favoriting,
#    charting_library_export_chart_data, chart_drag_export, save_chart_properties_to_local_storage,
#    use_localstorage_for_settings, saveload_requires_authentication, saveload_storage_customization,
#    saveload_separate_drawings_storage, saved_charts_count_restriction, charts_auto_save,
#    save_old_chart_before_save_as, refresh_saved_charts_list_on_dialog_show,
#    confirm_overwrite_if_chart_layout_with_name_exists, chart_template_storage,
#    left_toolbar, right_toolbar, hide_left_toolbar_by_default, control_bar,
#    widgetbar_tabs, show_right_widgets_panel_by_default, hide_right_toolbar, hide_right_toolbar_tabs,
#    header_widget, header_widget_dom_node, header_symbol_search, header_resolutions,
#    header_interval_dialog_button, show_interval_dialog_on_key_press, header_chart_type,
#    header_settings, header_indicators, header_compare, header_undo_redo, header_quick_search,
#    header_saveload, symbol_search_hot_key, symbol_search_parser_mixin,
#    expand_symbolsearch_items, symbol_search_three_columns_exchanges, symbol_search_flags,
#    symbol_search_limited_exchanges, symbol_search_option_chain_selector,
#    allow_arbitrary_symbol_search_input, compare_symbol, compare_recent_symbols_enabled,
#    show_symbol_logo_for_compare_studies, show_exchange_logos, show_symbol_logos,
#    force_exchange_as_title, prefer_symbol_name_over_fullname, prefer_quote_short_name,
#    use_symbol_name_for_header_toolbar, uppercase_instrument_names, symbol_info,
#    symbol_info_long_description, symbol_info_price_source, text_notes,
#    text-note-align-anchor-to-corner, image_drawingtool, linetoolpropertieswidget_template_button,
#    source_selection_markers, support_manage_drawings, display_data_mode, datasource_copypaste,
#    pane_context_menu, scales_context_menu, legend_context_menu, context_menus,
#    custom_items_in_context_menu, study_on_study, volume_force_overlay,
#    create_volume_indicator_by_default, create_volume_indicator_by_default_once,
#    hide_volume_ma, stop_study_on_restart, dont_show_boolean_study_arguments,
#    hide_last_na_study_output, study_dialog_fundamentals_economy_addons,
#    study_symbol_ticker_description, show_spread_operators, hide_exponentiation_spread_operator,
#    hide_reciprocal_spread_operator, compare_symbol_search_spread_operators,
#    studies_symbol_search_spread_operators, moving_average_study_changable_currency_unit,
#    plain_studymarket, lean_chart_load, insert_indicator_dialog_shortcut, save_shortcut,
#    popup_hints, accessible_keyboard_shortcuts, advanced_emoji_in_titles, charts_emoji_sync,
#    aria_crosshair_price_description, aria_detailed_chart_descriptions, disable_pulse_animation,
#    graying_disabled_tools_enabled, constraint_dialogs_movement, show_dialog_on_double_click,
#    library_custom_color_themes, tpo_summary, bugreport_button, footer_publish_idea_button,
#    hide_publish_button, show_source_code, show_login_dialog, phone_verification,
#    whotrades_auth_only, referral_program_for_widget_owners, hide_alert_referral_tool,
#    hide_chats_page, hide_ideas_page, hide_ideas_streams_page, hide_open_popup_button,
#    show_community_feed_button, mobile_app_action_open_details_webview, mobile_app_hide_replay_toolbar,
#    app_phone, app_tablet, symphony_embed, iframe_loading_compatibility_mode,
#    iframe_loading_same_origin, iframe_loading_root_path, skip_event_target_check,
#    embed_resizer_overrides, extended_extrapolation_limit, use_na_string_for_not_available_values,
#    small_no_display, charting_library_single_symbol_request, charting_library_debug_mode,
#    show_chart_warn_message, auto_enable_symbol_labels, 14851, 38914, atsv2s

print("Categorization logic ready.")
