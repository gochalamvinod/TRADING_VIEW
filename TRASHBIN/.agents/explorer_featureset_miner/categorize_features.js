const fs = require('fs');
const path = require('path');

const minedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_mined_features.json'), 'utf8'));
const features = minedData.features;

const indexHtml = fs.readFileSync('E:/TRADINGVIEW ADVANCED/index.html', 'utf8');

function extractArray(content, key) {
  const re = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = content.match(re);
  if (!match) return [];
  const inside = match[1];
  const items = [];
  const itemRe = /['"]([a-zA-Z0-9_-]+)['"]/g;
  let m;
  while ((m = itemRe.exec(inside)) !== null) {
    items.push(m[1]);
  }
  return items;
}

const currentEnabled = new Set(extractArray(indexHtml, 'enabled_features'));
const currentDisabled = new Set(extractArray(indexHtml, 'disabled_features'));

// Function to classify a feature into a category
function categorize(feat) {
  const f = feat.toLowerCase();

  // Trading & Broker
  if (
    f.includes('trading') || f.includes('broker') || f.includes('order') ||
    f.includes('position') || f.includes('buy_sell') || f.includes('bracket') ||
    f.includes('execution') || f.includes('reverse') || f.includes('close_order') ||
    f.includes('close_position')
  ) {
    return 'Trading & Broker Integration';
  }

  // DOM / Depth
  if (f.includes('dom') || f.includes('depth') || f.includes('orderbook')) {
    return 'DOM & Depth of Market';
  }

  // Chart styles & series
  if (
    f.includes('chart_style') || f.includes('japanese') || f.includes('bar_') ||
    f.includes('bars_') || f.includes('candles') || f.includes('renko') ||
    f.includes('kagi') || f.includes('pnf') || f.includes('line_break') ||
    f.includes('hilo') || f.includes('heikin') || f.includes('baseline') ||
    f.includes('dwm') || f.includes('low_density') || f.includes('series') ||
    f.includes('resolution_rebuild')
  ) {
    return 'Chart Styles & Series Rendering';
  }

  // Multi-chart
  if (f.includes('multichart') || f.includes('layout') || f.includes('move_chart_in_layout')) {
    return 'Multi-Chart Layouts';
  }

  // Watchlist & Details & Object Tree & Data Window
  if (
    f.includes('watchlist') || f.includes('details') || f.includes('data_window') ||
    f.includes('object_tree') || f.includes('widgetbar') || f.includes('quote_summary') ||
    f.includes('symbol_info') || f.includes('marked_symbols') || f.includes('add_to_watchlist')
  ) {
    return 'Watchlist, Details, Object Tree & Sidebar';
  }

  // Header controls & UI bars
  if (
    f.includes('header_') || f.includes('toolbar') || f.includes('control_bar') ||
    f.includes('fullscreen') || f.includes('collapsible_header') || f.includes('quick_search')
  ) {
    return 'Header & Toolbars';
  }

  // Resolutions, Sessions, Countdown, Scales
  if (
    f.includes('resolution') || f.includes('session') || f.includes('countdown') ||
    f.includes('market_status') || f.includes('scales') || f.includes('pricescale') ||
    f.includes('timescale') || f.includes('timezone') || f.includes('timeframe') ||
    f.includes('interval') || f.includes('go_to_date') || f.includes('marks') ||
    f.includes('tick_marks') || f.includes('time_hours') || f.includes('date_format')
  ) {
    return 'Timeframes, Scales, Sessions & Countdown';
  }

  // Indicators, Studies, Volume Profile, Pine
  if (
    f.includes('study') || f.includes('indicator') || f.includes('volume') ||
    f.includes('pine') || f.includes('spread') || f.includes('compare') ||
    f.includes('financials')
  ) {
    return 'Indicators, Studies & Volume Profile';
  }

  // Drawings & Line Tools
  if (
    f.includes('drawing') || f.includes('linetool') || f.includes('datasource') ||
    f.includes('magnet') || f.includes('measure') || f.includes('crosshair')
  ) {
    return 'Drawing Tools & Canvas Operations';
  }

  // Saveload, Storage, Properties, General UI
  return 'General UI, Persistence & Platform Features';
}

// Safety and Impact Analysis
function assessSafety(feat, parentFeatures, subsets) {
  const f = feat;

  // Hazardous: Things that require external backend servers, auth servers, or break custom UI
  const hazardous = [
    'link_to_tradingview',       // Sends users away to external tradingview.com
    'saveload_requires_authentication', // Forces auth modal that blocks chart saving if not authenticated
    'phone_verification',        // Forces phone SMS verification dialog
    'show_login_dialog',         // Prompts login modal
    'whotrades_auth_only',       // Whotrades broker login restriction
    'saved_charts_count_restriction', // Artificially restricts saved chart layouts
    'allow_supported_resolutions_set_only', // Blocks custom seconds/ticks if enabled
    'news_widget',               // Disabled in index.html, requires external RSS/news backend
    'news_provider',             // Disabled in index.html
    'hide_left_toolbar_by_default', // Hides the main drawing toolbar on startup!
    'app_phone',                 // Forces mobile phone view
    'app_tablet',                // Forces tablet view
    'mobile_trading',            // Mobile trading mode
    'chart_hide_close_position_button', // Removes the close button from chart position line!
    'chart_hide_close_order_button',    // Removes the close button from chart order line!
    'disable_resolution_rebuild', // Can break bar building on custom resolutions
    'disable_sameinterval_aligning' // Can misalign intraday bars
  ];

  if (hazardous.includes(f)) {
    return {
      safety: 'Hazardous / Breaking',
      recommendation: 'Keep Disabled',
      rationale: 'Breaks local workflows, forces external auth/login, restricts charts, or hides critical trading UI controls.'
    };
  }

  // Already enabled
  if (currentEnabled.has(f)) {
    return {
      safety: 'Safe & Verified',
      recommendation: 'Already Enabled',
      rationale: 'Active in index.html and working correctly.'
    };
  }

  // Currently disabled
  if (currentDisabled.has(f)) {
    return {
      safety: 'Explicitly Disabled',
      recommendation: 'Keep Disabled',
      rationale: 'Explicitly disabled in index.html to prevent misbehavior.'
    };
  }

  // Check if beneficial
  const beneficialCandidates = [
    'legend_last_day_change',
    'show_percent_option_for_right_margin',
    'accessible_keyboard_shortcuts',
    'advanced_emoji_in_titles',
    'pricescale_currency',
    'pricescale_unit',
    'use_last_visible_bar_value_in_legend',
    'confirm_overwrite_if_chart_layout_with_name_exists',
    'determine_first_data_request_size_using_visible_range',
    'use_na_string_for_not_available_values',
    'show_last_price_and_change_only_in_series_legend',
    'auto_enable_symbol_labels',
    'symbol_search_parser_mixin',
    'symbol_search_hot_key',
    'symbol_search_three_columns_exchanges',
    'symbol_search_flags',
    'symbol_search_limited_exchanges',
    'symbol_search_option_chain_selector',
    'compare_symbol',
    'compare_recent_symbols_enabled',
    'prefer_quote_short_name',
    'prefer_symbol_name_over_fullname',
    'saveload_separate_drawings_storage',
    'save_old_chart_before_save_as',
    'charts_auto_save',
    'support_manage_drawings',
    'side_toolbar_in_fullscreen_mode',
    'header_in_fullscreen_mode',
    'remove_library_container_border',
    'insert_indicator_dialog_shortcut',
    'shift_visible_range_on_new_bar',
    'cropped_tick_marks',
    'lock_visible_time_range_on_resize',
    'no_min_chart_width',
    'clear_bars_on_series_error',
    'hide_loading_screen_on_series_error',
    'no_bars_status',
    'clear_price_scale_on_error_or_empty_bars',
    'show_zoom_and_move_buttons_on_touch',
    'right_bar_stays_on_scroll',
    'display_legend_on_all_charts',
    'star_some_intervals_by_default',
    'library_custom_color_themes',
    'adaptive_logo',
    'show_spread_operators',
    'fix_left_edge',
    'secondary_series_extend_time_scale',
    'studies_extend_time_scale',
    'mouse_wheel_scale',
    'pinch_scale',
    'axis_pressed_mouse_move_scale',
    'mouse_wheel_scroll',
    'pressed_mouse_move_scroll',
    'horz_touch_drag_scroll',
    'vert_touch_drag_scroll',
    'dont_show_boolean_study_arguments',
    'hide_last_na_study_output',
    'price_scale_always_last_bar_value',
    'study_dialog_fundamentals_economy_addons',
    'two_character_bar_marks_labels',
    'study_symbol_ticker_description',
    'study_overlay_compare_legend_option',
    'charting_library_single_symbol_request',
    'use_ticker_on_symbol_info_update',
    'hide_image_invalid_symbol',
    'hide_object_tree_and_price_scale_exchange_label',
    'hide_volume_ma',
    'small_no_display',
    'text_notes',
    'show_source_code',
    'scales_date_format',
    'scales_time_hours_format',
    'chart_property_page_right_margin_editor',
    'header_widget_dom_node',
    'chart_property_page'
  ];

  if (beneficialCandidates.includes(f)) {
    return {
      safety: 'Safe & Highly Recommended',
      recommendation: 'Enable in index.html',
      rationale: 'Enhances charting functionality, UI responsiveness, ergonomics, formatting, or shortcuts without negative side-effects.'
    };
  }

  return {
    safety: 'Safe / Low-Risk',
    recommendation: 'Optional / Safe to Enable',
    rationale: 'Standard TradingView featureset toggle; activates specific UI convenience or sub-module.'
  };
}

const categorizedList = features.map(item => {
  const cat = categorize(item.feature);
  const assess = assessSafety(item.feature, item.parentFeatures, item.subsets);
  return {
    ...item,
    category: cat,
    safety: assess.safety,
    recommendation: assess.recommendation,
    rationale: assess.rationale,
    statusInIndex: currentEnabled.has(item.feature) ? 'Enabled' : (currentDisabled.has(item.feature) ? 'Disabled' : 'Unlisted')
  };
});

fs.writeFileSync(
  path.join(__dirname, 'categorized_features.json'),
  JSON.stringify({
    total: categorizedList.length,
    byCategory: categorizedList.reduce((acc, cur) => {
      acc[cur.category] = (acc[cur.category] || 0) + 1;
      return acc;
    }, {}),
    byStatus: categorizedList.reduce((acc, cur) => {
      acc[cur.statusInIndex] = (acc[cur.statusInIndex] || 0) + 1;
      return acc;
    }, {}),
    byRecommendation: categorizedList.reduce((acc, cur) => {
      acc[cur.recommendation] = (acc[cur.recommendation] || 0) + 1;
      return acc;
    }, {}),
    features: categorizedList
  }, null, 2),
  'utf8'
);

console.log('Categorization complete!');
console.log('Counts by Category:');
const byCat = categorizedList.reduce((acc, cur) => { acc[cur.category] = (acc[cur.category] || 0) + 1; return acc; }, {});
console.log(byCat);

console.log('\nCounts by Status in index.html:');
const byStat = categorizedList.reduce((acc, cur) => { acc[cur.statusInIndex] = (acc[cur.statusInIndex] || 0) + 1; return acc; }, {});
console.log(byStat);

console.log('\nCounts by Recommendation:');
const byRec = categorizedList.reduce((acc, cur) => { acc[cur.recommendation] = (acc[cur.recommendation] || 0) + 1; return acc; }, {});
console.log(byRec);
