import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update disabled_features: add widget_logo, adaptive_logo, etc., remove context_menus
old_disabled_chunk = '''            "pane_context_menu",
            "charting_library_export_chart_data",

            // ── Advanced Ergonomics, Scaling & Navigation ───────────────
            "chart_property_page_right_margin_editor",
            "chart_template_storage",
            "chart_drag_export",
            "scales_date_format",
            "scales_time_hours_format",
            "shift_visible_range_on_new_bar",
            "cropped_tick_marks",
            "insert_indicator_dialog_shortcut",
            "symbol_search_hot_key",
            "compare_recent_symbols_enabled",
            "clear_price_scale_on_error_or_empty_bars",
            "use_localstorage_for_settings",
            "saveload_storage_customization",
            "refresh_saved_charts_list_on_dialog_show",
            "right_bar_stays_on_scroll",
            "handle_scale",
            "handle_scroll",
            "context_menus",
            "custom_items_in_context_menu",'''

new_disabled_chunk = '''            "charting_library_export_chart_data",

            // ── Advanced Ergonomics, Scaling & Navigation ───────────────
            "chart_property_page_right_margin_editor",
            "chart_template_storage",
            "chart_drag_export",
            "scales_date_format",
            "scales_time_hours_format",
            "shift_visible_range_on_new_bar",
            "cropped_tick_marks",
            "insert_indicator_dialog_shortcut",
            "symbol_search_hot_key",
            "compare_recent_symbols_enabled",
            "clear_price_scale_on_error_or_empty_bars",
            "use_localstorage_for_settings",
            "saveload_storage_customization",
            "refresh_saved_charts_list_on_dialog_show",
            "right_bar_stays_on_scroll",
            "handle_scale",
            "handle_scroll",
            "custom_items_in_context_menu",
            "widget_logo",
            "adaptive_logo",
            "logo_without_link",
            "move_logo_to_main_pane",
            "show_animated_logo",
            "link_to_tradingview",
            "text_notes",'''

assert old_disabled_chunk in content, "old_disabled_chunk not found"
content = content.replace(old_disabled_chunk, new_disabled_chunk, 1)

# Also remove legend_context_menu and scales_context_menu from disabled_features
content = content.replace('"legend_context_menu", ', '')
content = content.replace('"scales_context_menu", ', '')

# 2. Update enabled_features: add context_menus, pane_context_menu, legend_context_menu, scales_context_menu
# Remove adaptive_logo, legend_last_day_change, text_notes, use_na_string_for_not_available_values, logo_without_link
old_enabled_chunk = '''            // ── Safe Library Enhancements & Advanced Usability ───────────
            "adaptive_logo",
            "advanced_emoji_in_titles",
            "align_dwm_bars_to_main_series",
            "allow_arbitrary_symbol_search_input",
            "aria_crosshair_price_description",
            "aria_detailed_chart_descriptions",
            "bypass_chart_height_check",
            "charts_emoji_sync",
            "clear_bars_on_series_error",
            "control_bar",
            "determine_first_data_request_size_using_visible_range",
            "display_legend_on_all_charts",
            "extended_extrapolation_limit",
            "fix_left_edge",
            "graying_disabled_tools_enabled",
            "image_drawingtool",
            "legend_last_day_change",
            "library_custom_color_themes",
            "moving_average_study_changable_currency_unit",
            "price_scale_always_last_bar_value",
            "saveload_separate_drawings_storage",
            "secondary_series_extend_time_scale",
            "show_zoom_and_move_buttons_on_touch",
            "star_some_intervals_by_default",
            "studies_extend_time_scale",
            "symbol_search_option_chain_selector",
            "text_notes",
            "tpo_summary",
            "uppercase_instrument_names",
            "use_last_visible_bar_value_in_legend",
            "use_na_string_for_not_available_values",
            "use_symbol_name_for_header_toolbar",
            "use_ticker_on_symbol_info_update",

            // ── Additional Usability & Clean UI Enhancements ─────────────
            "collapsible_header",
            "hide_publish_button",
            "hide_chats_page",
            "hide_ideas_page",
            "hide_ideas_streams_page",
            "logo_without_link",'''

new_enabled_chunk = '''            // ── Safe Library Enhancements & Advanced Usability ───────────
            "context_menus",
            "pane_context_menu",
            "legend_context_menu",
            "scales_context_menu",
            "advanced_emoji_in_titles",
            "align_dwm_bars_to_main_series",
            "allow_arbitrary_symbol_search_input",
            "aria_crosshair_price_description",
            "aria_detailed_chart_descriptions",
            "bypass_chart_height_check",
            "charts_emoji_sync",
            "clear_bars_on_series_error",
            "control_bar",
            "determine_first_data_request_size_using_visible_range",
            "display_legend_on_all_charts",
            "extended_extrapolation_limit",
            "fix_left_edge",
            "graying_disabled_tools_enabled",
            "image_drawingtool",
            "library_custom_color_themes",
            "moving_average_study_changable_currency_unit",
            "price_scale_always_last_bar_value",
            "saveload_separate_drawings_storage",
            "secondary_series_extend_time_scale",
            "show_zoom_and_move_buttons_on_touch",
            "star_some_intervals_by_default",
            "studies_extend_time_scale",
            "symbol_search_option_chain_selector",
            "tpo_summary",
            "uppercase_instrument_names",
            "use_last_visible_bar_value_in_legend",
            "use_symbol_name_for_header_toolbar",
            "use_ticker_on_symbol_info_update",

            // ── Additional Usability & Clean UI Enhancements ─────────────
            "collapsible_header",
            "hide_publish_button",
            "hide_chats_page",
            "hide_ideas_page",
            "hide_ideas_streams_page",'''

assert old_enabled_chunk in content, "old_enabled_chunk not found"
content = content.replace(old_enabled_chunk, new_enabled_chunk, 1)

# 3. Add removeWatermarkLogo implementation and call it in removeVolumeStudies and applyLegendOverrides
watermark_func = '''        function removeWatermarkLogo() {
          try {
            const chart = widget.activeChart();
            if (!chart) return;
            const model = chart._chartWidget?._model?.model() || chart.model?.();
            if (!model) return;
            const panes = model.panes ? model.panes() : [];
            panes.forEach(p => {
              const cs = p.customSources ? p.customSources().slice() : [];
              cs.forEach(s => {
                if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                  s._needToShow = false;
                  s._showBranding = false;
                  if (s._powBy) s._powBy.show = false;
                  if (typeof p.removeCustomSource === 'function') {
                    try { p.removeCustomSource(s); } catch(e) {}
                  }
                }
              });
            });
            const allCS = model.customSources ? model.customSources().slice() : [];
            allCS.forEach(s => {
              if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                s._needToShow = false;
                s._showBranding = false;
                if (s._powBy) s._powBy.show = false;
                if (typeof model.removeCustomSource === 'function') {
                  try { model.removeCustomSource(s); } catch(e) {}
                }
              }
            });
            if (typeof model.fullUpdate === 'function') model.fullUpdate();
          } catch (e) {}
        }
'''

content = content.replace('function removeVolumeStudies() {', watermark_func + '\n        function removeVolumeStudies() {\n          removeWatermarkLogo();')

# 4. Clean up gesture listeners: remove dblclick & single-finger tap hijacking, keep native right-click context menu
old_gesture_chunk = '''                // Single-finger double-tap check (< 380ms)
                if (e.changedTouches && e.changedTouches.length === 1 && (!e.touches || e.touches.length === 0)) {
                  const t = e.changedTouches[0];
                  const now = Date.now();
                  const dt = now - lastSingleTapTime;
                  const dist = Math.hypot(t.clientX - lastSingleTapPos.x, t.clientY - lastSingleTapPos.y);
                  if (dt > 50 && dt < 380 && dist < 35) {
                    lastSingleTapTime = 0;
                    const target = t.target;
                    if (target && (target.tagName === 'CANVAS' || target.classList?.contains('pane') || target.closest?.('[data-name="legend"]'))) {
                      openChartOrStudySettings(t.clientX, t.clientY);
                    }
                    return;
                  }
                  lastSingleTapTime = now;
                  lastSingleTapPos = { x: t.clientX, y: t.clientY };
                }
              }, { passive: false, capture: true });

              innerDoc.addEventListener('touchcancel', () => {
                twoFingerTouchState = null;
              }, { passive: true, capture: true });

              // B. Trackpad Two-Finger Tap & Secondary Click / Context Menu
              const handleSecondaryClick = (e) => {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                  return; // Preserve text input context menus
                }
                e.preventDefault();
                e.stopPropagation();
                openChartOrStudySettings(e.clientX, e.clientY);
              };

              innerDoc.addEventListener('contextmenu', handleSecondaryClick, { capture: true });

              // C. Double Click on Canvas or Legend
              innerDoc.addEventListener('dblclick', (e) => {
                if (e.target && (e.target.tagName === 'CANVAS' || e.target.closest?.('[data-name="legend"]'))) {
                  openChartOrStudySettings(e.clientX, e.clientY);
                }
              }, { capture: true });'''

new_gesture_chunk = '''              }, { passive: false, capture: true });

              innerDoc.addEventListener('touchcancel', () => {
                twoFingerTouchState = null;
              }, { passive: true, capture: true });

              // Allow native TradingView context menu on right click / secondary click
              // (Native TradingView context menu includes "Settings..." which opens the dialog)'''

assert old_gesture_chunk in content, "old_gesture_chunk not found"
content = content.replace(old_gesture_chunk, new_gesture_chunk, 1)

# Also remove the container-level fallback contextmenu hijacking
old_container_ctx = '''            // Container-level fallback for trackpad / secondary click
            const containerEl = document.getElementById("tv_chart_container");
            if (containerEl && !containerEl._twoFingerSettingsAttached) {
              containerEl._twoFingerSettingsAttached = true;
              containerEl.addEventListener('contextmenu', (e) => {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                openChartOrStudySettings(e.clientX, e.clientY);
              }, { capture: true });
            }'''

new_container_ctx = '''            // Periodic cleanup of watermark logo
            setInterval(removeWatermarkLogo, 3000);'''

assert old_container_ctx in content, "old_container_ctx not found"
content = content.replace(old_container_ctx, new_container_ctx, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied updates to index.html")
