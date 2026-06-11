// app.js - Walk Route Planner Logic (3-Tier & Pop Version)

// Global Application State
let stationsData = [];
let selectedDistanceRange = { min: 2, max: 3 }; // Default "サクッと" (2-3km)
let currentRoute = null;

// Region to Prefecture mapping (North to South order)
const REGION_MAP = {
    "北海道・東北": ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
    "関東": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
    "中部": ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"],
    "近畿": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
    "中国": ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
    "四国": ["徳島県", "香川県", "愛媛県", "高知県"],
    "九州・沖縄": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
};

// Create reverse map for pref -> region lookup
const PREF_TO_REGION = {};
Object.entries(REGION_MAP).forEach(([region, prefs]) => {
    prefs.forEach(pref => {
        PREF_TO_REGION[pref] = region;
    });
});

// DOM Elements
const panelSetup = document.getElementById('panel-setup');
const panelResult = document.getElementById('panel-result');
const areaSelector = document.getElementById('area-selector');
const btnGenerate = document.getElementById('btn-generate');
const btnReroll = document.getElementById('btn-reroll');
const btnBack = document.getElementById('btn-back');
const btnGoogleMap = document.getElementById('btn-google-map');
const setupError = document.getElementById('setup-error');
const resultError = document.getElementById('result-error');
const loadingOverlay = document.getElementById('loading-overlay');

// Custom Distance inputs
const customDistanceContainer = document.getElementById('custom-distance-container');
const inputMinDistance = document.getElementById('min-distance');
const inputMaxDistance = document.getElementById('max-distance');

// Result Screen DOM Elements
const startStationName = document.getElementById('start-station-name');
const startStationLines = document.getElementById('start-station-lines');
const endStationName = document.getElementById('end-station-name');
const endStationLines = document.getElementById('end-station-lines');
const routeDistance = document.getElementById('route-distance');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    showLoading(true, "駅データをロード中...");
    try {
        const response = await fetch('stations.json');
        if (!response.ok) {
            throw new Error('駅データの読み込みに失敗しました。');
        }
        stationsData = await response.json();
        
        build3TierAreaTree();
        setupEventListeners();
        showLoading(false);
    } catch (error) {
        showLoading(false);
        showError(setupError, `初期化エラー: ${error.message}`);
    }
}

// Build hierarchical 3-Tier check list (Region -> Prefecture -> City)
function build3TierAreaTree() {
    // 1. Group cities by pref, then by region
    // Structure: regionMapData = { "関東": { "東京都": Set("大田区", "新宿区", ...), ... } }
    const regionMapData = {};
    
    stationsData.forEach(station => {
        const pref = station.pref;
        const city = station.city;
        if (!pref || !city) return;
        
        const region = PREF_TO_REGION[pref];
        if (!region) return; // Skip if prefecture is not registered in map
        
        if (!regionMapData[region]) {
            regionMapData[region] = {};
        }
        if (!regionMapData[region][pref]) {
            regionMapData[region][pref] = new Set();
        }
        regionMapData[region][pref].add(city);
    });

    areaSelector.innerHTML = '';

    // 2. Generate DOM in North-to-South ordered Region & Prefecture, and Japanese alphabetical sorted City
    const orderedRegions = ["北海道・東北", "関東", "中部", "近畿", "中国", "四国", "九州・沖縄"];
    
    orderedRegions.forEach(region => {
        const prefsData = regionMapData[region];
        if (!prefsData) return; // If region contains no active stations, skip

        // Create Tier 1: Region Group
        const regionGroup = document.createElement('div');
        regionGroup.className = 'region-group';
        
        const regionHeader = document.createElement('div');
        regionHeader.className = 'region-header';
        
        const regionCheckbox = document.createElement('input');
        regionCheckbox.type = 'checkbox';
        regionCheckbox.className = 'region-checkbox';
        regionCheckbox.dataset.region = region;
        
        const regionLabel = document.createElement('span');
        regionLabel.className = 'region-label';
        regionLabel.textContent = region;
        
        const toggleIcon = document.createElement('div');
        toggleIcon.className = 'toggle-icon';
        toggleIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        
        regionHeader.appendChild(regionCheckbox);
        regionHeader.appendChild(regionLabel);
        regionHeader.appendChild(toggleIcon);
        regionGroup.appendChild(regionHeader);
        
        // Tier 2 list under region
        const prefList = document.createElement('div');
        prefList.className = 'pref-list';
        
        // Sort prefectures according to defined REGION_MAP list
        const orderedPrefs = REGION_MAP[region].filter(p => prefsData[p] !== undefined);
        
        orderedPrefs.forEach(pref => {
            const citiesSet = prefsData[pref];
            
            // Create Tier 2: Prefecture Group
            const prefGroup = document.createElement('div');
            prefGroup.className = 'pref-group';
            
            const prefHeader = document.createElement('div');
            prefHeader.className = 'pref-header';
            
            const prefCheckbox = document.createElement('input');
            prefCheckbox.type = 'checkbox';
            prefCheckbox.className = 'pref-checkbox';
            prefCheckbox.dataset.region = region;
            prefCheckbox.dataset.pref = pref;
            
            const prefLabel = document.createElement('span');
            prefLabel.className = 'pref-label';
            prefLabel.textContent = pref;
            
            const prefToggleIcon = document.createElement('div');
            prefToggleIcon.className = 'toggle-icon';
            prefToggleIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            
            prefHeader.appendChild(prefCheckbox);
            prefHeader.appendChild(prefLabel);
            prefHeader.appendChild(prefToggleIcon);
            prefGroup.appendChild(prefHeader);
            
            // Tier 3 list under prefecture
            const cityList = document.createElement('div');
            cityList.className = 'city-list';
            
            // Sort cities alphabetically in Japanese 50音順 using localeCompare
            const sortedCities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b, 'ja'));
            
            sortedCities.forEach(city => {
                const label = document.createElement('label');
                label.className = 'checkbox-item';
                
                const cityCheckbox = document.createElement('input');
                cityCheckbox.type = 'checkbox';
                cityCheckbox.className = 'city-checkbox';
                cityCheckbox.dataset.region = region;
                cityCheckbox.dataset.pref = pref;
                cityCheckbox.dataset.city = city;
                
                label.appendChild(cityCheckbox);
                label.appendChild(document.createTextNode(city));
                cityList.appendChild(label);
                
                // City Checkbox change event
                cityCheckbox.addEventListener('change', () => {
                    updatePrefCheckboxState(pref);
                    updateRegionCheckboxState(region);
                    updateGenerateButtonState();
                });
            });
            
            prefGroup.appendChild(cityList);
            prefList.appendChild(prefGroup);
            
            // Prefecture Accordion toggling
            prefLabel.addEventListener('click', (e) => {
                e.stopPropagation();
                prefGroup.classList.toggle('open');
            });
            prefToggleIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                prefGroup.classList.toggle('open');
            });
            
            // Prefecture Checkbox change event
            prefCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                prefCheckbox.indeterminate = false;
                
                const cityCbs = cityList.querySelectorAll('.city-checkbox');
                cityCbs.forEach(cb => {
                    cb.checked = isChecked;
                });
                
                updateRegionCheckboxState(region);
                updateGenerateButtonState();
            });
        });
        
        regionGroup.appendChild(prefList);
        areaSelector.appendChild(regionGroup);
        
        // Region Accordion toggling
        regionLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            regionGroup.classList.toggle('open');
        });
        toggleIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            regionGroup.classList.toggle('open');
        });
        
        // Region Checkbox change event
        regionCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            regionCheckbox.indeterminate = false;
            
            const prefCbs = prefList.querySelectorAll('.pref-checkbox');
            const cityCbs = prefList.querySelectorAll('.city-checkbox');
            
            prefCbs.forEach(cb => {
                cb.checked = isChecked;
                cb.indeterminate = false;
            });
            cityCbs.forEach(cb => {
                cb.checked = isChecked;
            });
            
            updateGenerateButtonState();
        });
    });
}

// Update the checkbox state of parent prefecture based on its children
function updatePrefCheckboxState(pref) {
    const prefCheckbox = document.querySelector(`.pref-checkbox[data-pref="${pref}"]`);
    if (!prefCheckbox) return;
    
    const prefGroup = prefCheckbox.closest('.pref-group');
    const cityCheckboxes = prefGroup.querySelectorAll('.city-checkbox');
    
    const total = cityCheckboxes.length;
    const checkedCount = Array.from(cityCheckboxes).filter(cb => cb.checked).length;
    
    if (checkedCount === 0) {
        prefCheckbox.checked = false;
        prefCheckbox.indeterminate = false;
    } else if (checkedCount === total) {
        prefCheckbox.checked = true;
        prefCheckbox.indeterminate = false;
    } else {
        prefCheckbox.checked = false;
        prefCheckbox.indeterminate = true;
    }
}

// Update the checkbox state of grandparent region based on its children (pref / city)
function updateRegionCheckboxState(region) {
    const regionCheckbox = document.querySelector(`.region-checkbox[data-region="${region}"]`);
    if (!regionCheckbox) return;
    
    const regionGroup = regionCheckbox.closest('.region-group');
    const cityCheckboxes = regionGroup.querySelectorAll('.city-checkbox');
    
    const total = cityCheckboxes.length;
    const checkedCount = Array.from(cityCheckboxes).filter(cb => cb.checked).length;
    
    if (checkedCount === 0) {
        regionCheckbox.checked = false;
        regionCheckbox.indeterminate = false;
    } else if (checkedCount === total) {
        regionCheckbox.checked = true;
        regionCheckbox.indeterminate = false;
    } else {
        regionCheckbox.checked = false;
        regionCheckbox.indeterminate = true;
    }
}

// Enable/Disable generate button based on selection
function updateGenerateButtonState() {
    const selectedCities = getSelectedCities();
    btnGenerate.disabled = selectedCities.length === 0;
}

// Get selected cities as array of objects { pref, city }
function getSelectedCities() {
    const checkedCityCheckboxes = document.querySelectorAll('.city-checkbox:checked');
    return Array.from(checkedCityCheckboxes).map(cb => ({
        pref: cb.dataset.pref,
        city: cb.dataset.city
    }));
}

// Setup Event Listeners
function setupEventListeners() {
    // Distance option buttons
    const distanceOptions = document.querySelectorAll('.distance-option');
    distanceOptions.forEach(option => {
        option.addEventListener('click', () => {
            distanceOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            const mode = option.dataset.mode;
            if (mode === 'custom') {
                customDistanceContainer.classList.add('active');
                updateCustomDistanceRange();
            } else {
                customDistanceContainer.classList.remove('active');
                const min = parseFloat(option.dataset.min);
                const max = parseFloat(option.dataset.max);
                selectedDistanceRange = { min, max };
            }
        });
    });

    // Custom distance input events
    inputMinDistance.addEventListener('input', updateCustomDistanceRange);
    inputMaxDistance.addEventListener('input', updateCustomDistanceRange);

    // Area Selector Utility Buttons
    document.getElementById('btn-select-all').addEventListener('click', () => {
        document.querySelectorAll('.region-checkbox, .pref-checkbox, .city-checkbox').forEach(cb => {
            cb.checked = true;
            cb.indeterminate = false;
        });
        updateGenerateButtonState();
    });

    document.getElementById('btn-deselect-all').addEventListener('click', () => {
        document.querySelectorAll('.region-checkbox, .pref-checkbox, .city-checkbox').forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
        });
        updateGenerateButtonState();
    });

    // Action buttons
    btnGenerate.addEventListener('click', () => {
        generateRouteFlow();
    });

    btnReroll.addEventListener('click', () => {
        generateRouteFlow(true);
    });

    btnBack.addEventListener('click', () => {
        switchPanel('setup');
    });

    btnGoogleMap.addEventListener('click', () => {
        if (currentRoute) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${currentRoute.start.lat},${currentRoute.start.lon}&destination=${currentRoute.end.lat},${currentRoute.end.lon}&travelmode=walking`;
            window.open(url, '_blank');
        }
    });
}

// Update the range for custom distance mode
function updateCustomDistanceRange() {
    let min = parseFloat(inputMinDistance.value);
    let max = parseFloat(inputMaxDistance.value);
    
    // Validations
    if (isNaN(min) || min < 0.1) min = 0.1;
    if (isNaN(max) || max < min) max = min + 1.0;
    
    selectedDistanceRange = { min, max };
}

// Loading UI Helper
function showLoading(show, message = "ルート検索中...") {
    if (show) {
        loadingOverlay.querySelector('.loading-text').textContent = message;
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

// Error UI Helper
function showError(element, msg) {
    if (msg) {
        element.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>${msg}</span>
        `;
        element.style.display = 'flex';
    } else {
        element.style.display = 'none';
        element.innerHTML = '';
    }
}

// Panel Switcher
function switchPanel(panelName) {
    showError(setupError, null);
    showError(resultError, null);
    
    if (panelName === 'setup') {
        panelResult.classList.remove('active');
        panelSetup.classList.add('active');
    } else {
        panelSetup.classList.remove('active');
        panelResult.classList.add('active');
    }
}

// Haversine formula to calculate distance between two coordinates in km
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Flow to generate route, including loading presentation
function generateRouteFlow(isReroll = false) {
    const targetErrorElement = isReroll ? resultError : setupError;
    showError(targetErrorElement, null);
    showLoading(true, isReroll ? "新しいルートを探しています..." : "ルートを自動生成中...");

    // Smooth UI delay (350ms) to make it feel premium and performant
    setTimeout(() => {
        const success = pickRoute();
        showLoading(false);
        if (success) {
            displayRoute();
            if (!isReroll) {
                switchPanel('result');
            }
        } else {
            // Show error message
            const citiesStr = getSelectedCities().map(c => c.city).slice(0, 3).join('・');
            const truncatedCities = getSelectedCities().length > 3 ? `${citiesStr}...` : citiesStr;
            const rangeStr = `${selectedDistanceRange.min}〜${selectedDistanceRange.max}km`;
            
            showError(
                targetErrorElement, 
                `「${truncatedCities}」エリアで、距離 ${rangeStr} に収まる駅の組み合わせが時間内に見つかりませんでした。別のエリアを選択するか、距離を変更してください。`
            );
        }
    }, 450);
}

// Route Selection Core Logic
function pickRoute() {
    const selectedCities = getSelectedCities();
    if (selectedCities.length === 0) return false;

    // Filter stations in selected cities
    const filteredStations = stationsData.filter(station => {
        return selectedCities.some(sc => sc.pref === station.pref && sc.city === station.city);
    });

    // We need at least 2 stations to form a route
    if (filteredStations.length < 2) {
        return false;
    }

    const minDistance = selectedDistanceRange.min;
    const maxDistance = selectedDistanceRange.max;
    const maxAttempts = 1000;
    
    // Random selection with distance constraint (Monte Carlo approach)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const idx1 = Math.floor(Math.random() * filteredStations.length);
        let idx2 = Math.floor(Math.random() * filteredStations.length);
        
        // Ensure start and end stations are different
        if (idx1 === idx2) {
            continue;
        }

        const start = filteredStations[idx1];
        const end = filteredStations[idx2];

        const dist = calculateHaversineDistance(start.lat, start.lon, end.lat, end.lon);

        if (dist >= minDistance && dist <= maxDistance) {
            currentRoute = {
                start,
                end,
                distance: dist
            };
            return true;
        }
    }

    // Failsafe failed
    return false;
}

// Populate the DOM of results panel
function displayRoute() {
    if (!currentRoute) return;

    const { start, end, distance } = currentRoute;

    // Start Station
    startStationName.textContent = start.station_name;
    startStationLines.innerHTML = '';
    start.lines.forEach(line => {
        const badge = document.createElement('span');
        badge.className = 'line-badge';
        badge.textContent = line;
        startStationLines.appendChild(badge);
    });

    // End Station
    endStationName.textContent = end.station_name;
    endStationLines.innerHTML = '';
    end.lines.forEach(line => {
        const badge = document.createElement('span');
        badge.className = 'line-badge';
        badge.textContent = line;
        endStationLines.appendChild(badge);
    });

    // Distance
    routeDistance.textContent = distance.toFixed(2);
}
