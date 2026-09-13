# Dispatch: Spec Miner Survey M20-3 (100+ Native Featuresets & Broker Config Flags)

## Role & Working Directory
- Role: teamwork_preview_spec_miner
- Working Directory: E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3
- Parent: orchestrator_3 (Conv ID: 7015faef-6e19-4066-9069-10b490151baf)

## Objective & Task
You are the specialist specification miner for TradingView Charting Library featuresets and broker configuration flags.
Read `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (specifically section dated 2026-09-08T11:29:18Z).

Conduct an exhaustive probe across all 311 JS bundle files in `charting_library/bundles/*.js` and `charting_library.standalone.js`:
1. Discover, extract, and catalog ALL native featureset names supported by this TradingView library version (TT v29.6.0 Standalone).
   Look for feature sets in bundle files (search patterns like `enabled_features`, `disabled_features`, `isFeatureEnabled`, `create_feature_set`, `set_feature_state`, etc.).
   Categorize into:
   - Trading & Execution (e.g. `order_panel`, `order_panel_close_button`, `order_panel_undock`, `show_order_panel_on_start`, `trading_terminal`, `trading_account_manager`, `trading_notifications`, `show_trading_notifications_history`, `chart_property_page_trading`, `buy_sell_buttons`, `dom_widget`, `enable_dom_data_for_untradable_symbols`, `open_account_manager`, `broker_button`, `order_info`, `always_pass_called_order_to_modify`, `chart_crosshair_menu`, etc.)
   - Datafeed & Scales (`seconds_resolution`, `tick_resolution`, `custom_resolutions`, `pre_post_market_sessions`, `pre_post_market_price_line`, `show_average_close_price_line_and_label`, `countdown`, `display_market_status`, `go_to_date`, `timeframes_toolbar`, etc.)
   - Charts & Styles (`japanese_chart_styles`, `chart_style_hilo`, `chart_style_hilo_last_price`, `support_multicharts`, `additional_multichart_layouts`, `header_layouttoggle`, `header_screenshot`, etc.)
   - Watchlist & Tools (`multiple_watchlists`, `watchlist_import_export`, `watchlist_sections`, `watchlist_context_menu`, `watchlist_cross_tab_sync`, `fundamental_widget`, `options_details_widget`, `show_object_tree`, `keep_object_tree_widget_in_right_toolbar`, `object_tree_legend_mode`, `study_templates`, `drawing_templates`, `items_favoriting`, `charting_library_export_chart_data`, etc.)
2. Discover and catalog all `configFlags` supported on the Broker Adapter (e.g. `supportOrderBrackets`, `supportPositionBrackets`, `supportPlaceOrderPreview`, `supportModifyOrderPreview`, `supportLeverage`, `supportClosePosition`, `supportPartialClosePosition`, `supportModifyOrder`, `supportCancelOrder`, `supportOrderDialog`, `supportOrdersHistory`, `supportExecutions`, etc.).
3. Check `index.html` and `mt5_broker.js` against this catalog and document which featuresets and configFlags are currently missing or disabled.
4. Output a comprehensive catalog to `E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3/catalog.md` and write a structured `handoff.md`.

## 2026-09-08T11:31:36Z
You are teamwork_preview_spec_miner for Milestone M20 (Survey Phase).
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3.
Read your dispatch file at E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\DISPATCH.md and E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z).

Task:
Conduct an exhaustive probe across all 311 JS bundle files in charting_library/bundles/*.js and charting_library.standalone.js:
1. Discover, extract, and catalog ALL native featureset names supported by this TradingView library version (TT v29.6.0 Standalone).
   Search patterns like enabled_features, disabled_features, isFeatureEnabled, create_feature_set, set_feature_state.
   Categorize into:
   - Trading & Execution
   - Datafeed & Scales
   - Charts & Styles
   - Watchlist & Tools
2. Discover and catalog all configFlags supported on the Broker Adapter.
3. Check index.html and mt5_broker.js against this catalog and document which featuresets and configFlags are currently missing or disabled.
4. Output a comprehensive catalog to E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\catalog.md and write a structured handoff.md.

Update your progress.md regularly with Last visited timestamps. Send a completion message to parent when finished.
