'use client'; //client tarafında çalışacak bu kod yani tarayıcıda

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const getMarkerColor = (mag: number) => {
    if (mag < 3) return '#84cc16'; // Lime green
    if (mag < 4.5) return '#f97316'; // Orange
    if (mag < 6) return '#ef4444'; // Red
    return '#991b1b'; // Dark Red
};

const MAGNITUDE_LEGEND = [
    { label: '< 3', color: '#84cc16' },
    { label: '3 - 4.5', color: '#f97316' },
    { label: '4.5 - 6', color: '#ef4444' },
    { label: '6+', color: '#991b1b' },
];

// gelen yer adını diretk sayfada gösterir
const formatLocation = (title: string) => {
    return title || '';
};
// map çeşitlerim bruada 
const MAP_STYLES = {
    osm: {
        name: 'Street',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    },
    hybrid: {
        name: 'Hybrid',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, AEX, GeoEye, and the GIS User Community'
    }
};

export default function Map() {
    const [earthquakes, setEarthquakes] = useState<any[]>([]); //deprem listesi
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null); //son güncelleme zamanı
    const [secondsAgo, setSecondsAgo] = useState<number>(0); // kaç saniye geçti kısmı
    const [minMagnitude, setMinMagnitude] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [map, setMap] = useState<any>(null);
    const [mapStyle, setMapStyle] = useState<'hybrid' | 'osm'>('osm');

    // Pagination veri listesini sayfalara bölme 
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Resizing state for the right panel
    const [panelSize, setPanelSize] = useState({ width: 280, height: 450 });

    // Calculate items per page dynamically based on panel height
    const itemsPerPage = useMemo(() => {
        return Math.max(4, Math.floor((panelSize.height - 84) / 49));
    }, [panelSize.height]);

    // Resize Handlers
    // paneli köşesinden tutarak boyutunu değiştirme kısmı 
    const startResizeLeft = (e: React.MouseEvent) => {
        e.preventDefault();
        const startWidth = panelSize.width;
        const startX = e.clientX;

        const doResize = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(240, Math.min(600, startWidth - deltaX));
            setPanelSize(prev => ({ ...prev, width: newWidth }));
        };

        const stopResize = () => {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        };

        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
    };

    const startResizeBottom = (e: React.MouseEvent) => {
        e.preventDefault();
        const startHeight = panelSize.height;
        const startY = e.clientY;

        const doResize = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const newHeight = Math.max(250, Math.min(window.innerHeight - 100, startHeight + deltaY));
            setPanelSize(prev => ({ ...prev, height: newHeight }));
        };

        const stopResize = () => {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        };

        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
    };

    // genişlik ve yüksekliği aynı anda değiştirme 
    const startResizeCorner = (e: React.MouseEvent) => {
        e.preventDefault();
        const startWidth = panelSize.width;
        const startHeight = panelSize.height;
        const startX = e.clientX;
        const startY = e.clientY;

        const doResize = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            const newWidth = Math.max(240, Math.min(600, startWidth - deltaX));
            const newHeight = Math.max(250, Math.min(window.innerHeight - 100, startHeight + deltaY));
            setPanelSize({ width: newWidth, height: newHeight });
        };

        const stopResize = () => {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        };

        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
    };


    // VERİ ÇEKME (polling) sayfa açılır açılmaz çek sonra 60 saniyede çek
    useEffect(() => {
        const fetchEarthquakes = () => {
            fetch('/api/earthquakes')
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('API server returned error');
                    }
                    return response.json();
                })
                .then((data) => {
                    if (data && Array.isArray(data.features)) {
                        setEarthquakes(data.features);
                        setLastUpdated(new Date());
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Fetch error:', err);
                    setLoading(false);
                });
        };

        fetchEarthquakes();
        const intervalId = setInterval(fetchEarthquakes, 60000);
        return () => clearInterval(intervalId);
    }, []);


    // kaç saniye önce gösteren araçAyrı bir state olduğu için her saniye aktif ama markeları(?) (useMemo sayesinde) yeniden oluşmaz.????
    useEffect(() => {
        if (!lastUpdated) return;
        const tick = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(tick);
    }, [lastUpdated]);

    // Filtre değiştiğinde listeyi geri sar
    useEffect(() => {
        setCurrentPage(1);
    }, [minMagnitude]);

    // filtreleme (memoized??????)eartquakes ve minmagnitude değiştiğinde yeniden hesaplanır
    const filteredEarthquakes = useMemo(
        () => earthquakes.filter((quake: any) => quake.properties.mag >= minMagnitude),
        [earthquakes, minMagnitude]
    );

    // sayfalandırma matematiği
    const totalPages = Math.ceil(filteredEarthquakes.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredEarthquakes.slice(indexOfFirstItem, indexOfLastItem);

    // Sayfa boyutu değiştiğinde mevcut sayfa taşmaz  
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // markerlar (memoized) filteredEarthquakes değiştiğinde yeniden çizilir.
    const markers = useMemo(() => {
        return filteredEarthquakes.map((quake: any) => {
            const longitude = quake.geometry.coordinates[0];
            const latitude = quake.geometry.coordinates[1];
            const depth = quake.geometry.coordinates[2] || 0;
            const magnitude = quake.properties.mag || 0.0;
            const place = formatLocation(quake.properties.place || '');
            const markerColor = getMarkerColor(magnitude);

            // Format date: e.g. "29 Jun 2026 00:20:14"
            const formattedDate = new Date(quake.properties.time).toLocaleString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });


            return (
                <CircleMarker
                    key={quake.id}
                    center={[latitude, longitude]}
                    radius={magnitude > 0 ? magnitude * 2 : 2}
                    pathOptions={{
                        color: markerColor,
                        fillColor: markerColor,
                        fillOpacity: 0.6,
                        weight: 2
                    }}
                >
                    {/*  Depreme tıklanınca açılan detay kartı*/}
                    <Popup className="custom-quake-popup">
                        <div className="relative w-[270px] bg-white text-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans select-text border border-slate-100/50">
                            {/* Colored Top Bar */}
                            <div
                                className="h-[6px] w-full absolute top-0 left-0"
                                style={{ backgroundColor: markerColor }}
                            />

                            <div className="p-4 pt-5 flex flex-col">
                                {/* Header: Mag Badge + Title + Subtitle */}
                                <div className="flex items-center gap-3 mb-3 pr-4">
                                    <div
                                        className="flex items-center justify-center px-3 py-1.5 rounded-xl text-white font-extrabold text-sm tracking-tight shrink-0"
                                        style={{ backgroundColor: markerColor }}
                                    >
                                        {magnitude.toFixed(1)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-[13px] truncate leading-tight" title={place}>
                                            {place}
                                        </h4>
                                        <span className="text-[10px] text-slate-500 font-semibold tracking-wider">
                                            ML {magnitude.toFixed(1)}
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-100 my-1 mb-2.5" />

                                {/* Info List */}
                                <div className="flex flex-col gap-2.5 text-xs font-medium">
                                    {/* Time/Date */}
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <span className="text-slate-800 font-bold">{formattedDate}</span>
                                    </div>

                                    {/* Depth */}
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                            <polyline points="2 17 12 22 22 17" />
                                            <polyline points="2 12 12 17 22 12" />
                                        </svg>
                                        <span className="text-slate-500">Depth: <span className="font-bold text-slate-800">{depth.toFixed(1)} km</span></span>
                                    </div>

                                    {/* Coordinates */}
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="22" y1="12" x2="2" y2="12" />
                                            <line x1="12" y1="6" x2="12" y2="18" />
                                        </svg>
                                        <span className="font-bold text-slate-800">
                                            {Math.abs(latitude).toFixed(4)}°{latitude >= 0 ? 'N' : 'S'} {Math.abs(longitude).toFixed(4)}°{longitude >= 0 ? 'E' : 'W'}
                                        </span>
                                    </div>

                                    {/* Event Code / ID */}
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 19.5v-1.875c0-.621.504-1.125 1.125-1.125H18c.621 0 1.125.504 1.125 1.125V19.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 19.5z" />
                                        </svg>
                                        <span className="font-bold text-slate-800 truncate flex-1 select-all" title={quake.id}>
                                            {quake.id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </CircleMarker>
            );
        });
    }, [filteredEarthquakes]);
    //Listeden bir depreme tıklanınca haritayı o noktaya animasyonla götürür 
    const handleFlyTo = (lat: number, lng: number) => {
        if (map) {
            map.flyTo([lat, lng], 8, { duration: 1.5 });
        }
    };

    return (
        <div className="relative w-full h-screen">

            {/* sol üst köşe */}
            <div className="absolute top-6 left-6 z-[1000] bg-white/70 backdrop-blur-lg px-6 py-4 rounded-2xl shadow-lg border border-white/50 flex flex-col items-start pointer-events-auto">
                <div className="flex items-center gap-2.5">
                    <img src="/icon.png" alt="Logo" className="w-7 h-7 object-contain select-none" />
                    <h1 className="text-lg font-bold text-gray-800 tracking-tight">Live Earthquake Map</h1>
                </div>
                {/*x saniye önce kısmı  */}
                {lastUpdated && (
                    <p className="text-xs text-gray-500 font-medium mt-1 mb-3 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        {secondsAgo < 5 ? 'Just updated' : `Updated ${secondsAgo} seconds ago`}
                    </p>
                )}

                {/* büyüklük ayarlayıcı  */}
                <div className="w-full flex flex-col items-center">
                    <label className="text-sm font-semibold text-gray-700 mb-1">
                        Minimum Magnitude: <span className="text-red-500">{minMagnitude.toFixed(1)}+</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="7"
                        step="0.1"
                        value={minMagnitude}
                        onChange={(e) => setMinMagnitude(Number(e.target.value))}
                        className="w-48 cursor-pointer accent-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                    />
                </div>

                <div className="w-full border-t border-gray-200/50 my-3" />

                {/* harita tmeası  */}
                <div className="w-full flex flex-col items-start">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 select-none">
                        Map Style
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                        {Object.entries(MAP_STYLES).map(([key, style]) => (
                            <button
                                key={key}
                                onClick={() => setMapStyle(key as any)}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold tracking-tight border transition-all duration-200 select-none cursor-pointer ${mapStyle === key
                                    ? 'bg-red-600 text-white border-red-600 shadow-sm scale-[1.02]'
                                    : 'bg-white/60 text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                            >
                                {style.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* HOME/LOGO FLOATING BUTTON */}
            <div
                onClick={() => map && map.flyTo([39.0, 35.0], 7, { duration: 1.5 })}
                className="absolute bottom-6 left-6 z-[1000] w-11 h-11 bg-white rounded-full shadow-lg border border-slate-200/80 flex items-center justify-center pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 overflow-hidden group"
                title="Reset map view to default"
            >
                <img
                    src="/icon.png"
                    alt="Logo"
                    className="w-full h-full object-cover scale-[1.5] select-none transition-transform duration-300 group-hover:scale-[1.6]"
                />
            </div>

            {/* BÜYÜKLÜK LEJANTI */}
            <div className="absolute bottom-6 left-20 z-[1000] bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-3 text-xs pointer-events-auto">
                <div className="font-semibold mb-2 text-gray-700">Magnitude</div>
                {MAGNITUDE_LEGEND.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 mb-1 last:mb-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-gray-600">{item.label}</span>
                    </div>
                ))}
            </div>

            {/* SAĞ YAN PANEL — küçültülmüş, akışkan + sayfalı + boyutlandırılabilir */}
            <div
                style={{ width: `${panelSize.width}px`, height: `${panelSize.height}px` }}
                className="absolute top-6 right-6 z-[1000] bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 flex flex-col overflow-hidden pointer-events-auto"
            >
                {/* Resizing handles */}
                {/* Left edge resizer */}
                <div
                    onMouseDown={startResizeLeft}
                    className="absolute top-0 left-0 w-2 h-full cursor-w-resize z-[1010] group select-none"
                    title="Drag to resize width"
                >
                    <div className="w-1 h-full mx-auto bg-transparent group-hover:bg-red-500/30 group-active:bg-red-500 transition-colors duration-200" />
                </div>
                {/* Bottom edge resizer */}
                <div
                    onMouseDown={startResizeBottom}
                    className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-[1010] group select-none"
                    title="Drag to resize height"
                >
                    <div className="h-1 w-full my-auto bg-transparent group-hover:bg-red-500/30 group-active:bg-red-500 transition-colors duration-200" />
                </div>
                {/* Bottom-left corner resizer */}
                <div
                    onMouseDown={startResizeCorner}
                    className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-[1020] flex items-end justify-start p-0.5 group select-none"
                    title="Drag to resize"
                >
                    <svg className="w-3.5 h-3.5 text-gray-400 opacity-45 group-hover:opacity-100 group-hover:text-red-500 transition-all duration-200 transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 19L5 5M19 12L12 19" />
                    </svg>
                </div>

                <div className="bg-white/35 border-b border-gray-200/40 text-gray-800 py-3 px-4 text-center font-bold text-sm tracking-tight select-none">
                    Recent Earthquakes
                </div>

                <div className="relative flex-1 overflow-hidden">
                    {/* Üstte içerik kaybolma efekti */}
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/90 to-transparent z-10 pointer-events-none" />

                    <div className="feed-scroll h-full overflow-y-auto divide-y divide-gray-100">
                        {loading && (
                            <div className="p-6 text-center text-gray-400 text-xs">
                                Loading earthquakes...
                            </div>
                        )}

                        {/* key={currentPage} sayesinde sayfa değişince tüm liste yeniden
                            mount olur ve feedIn animasyonu her sayfa geçişinde tekrar oynar */}
                        <div key={currentPage}>
                            {!loading && currentItems.map((quake: any, index: number) => {
                                const mag = quake.properties.mag;
                                const place = formatLocation(quake.properties.place || '');
                                const time = new Date(quake.properties.time).toLocaleTimeString('en-US');
                                const lat = quake.geometry.coordinates[1];
                                const lng = quake.geometry.coordinates[0];
                                const color = getMarkerColor(mag);

                                return (
                                    <div
                                        key={quake.id}
                                        onClick={() => handleFlyTo(lat, lng)}
                                        className="feed-item p-2.5 hover:bg-black/[0.04] active:bg-black/[0.08] cursor-pointer transition-all flex items-center gap-2.5 border-b border-gray-200/30"
                                        style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
                                    >
                                        <div
                                            className="flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold shrink-0"
                                            style={{ backgroundColor: color }}
                                        >
                                            {mag.toFixed(1)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-gray-800 truncate font-medium leading-tight">{place}</div>
                                            <div className="text-[10px] text-gray-400">{time}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* depremleri bulamazsa */}
                        {!loading && currentItems.length === 0 && (
                            <div className="p-4 text-center text-gray-500 text-xs">
                                No earthquakes found matching this criteria.
                            </div>
                        )}
                    </div>

                    {/* Altta içerik kaybolma efekti */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/90 to-transparent z-10 pointer-events-none" />
                </div>

                {/* SAYFALANDIRMA BUTONLARI */}
                {totalPages > 1 && (
                    <div className="px-3 py-2 bg-white/30 border-t border-gray-200/40 flex justify-between items-center text-xs shrink-0 select-none z-[1005]">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((prev) => prev - 1)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-sm transition-all duration-200 flex items-center gap-1 select-none cursor-pointer disabled:cursor-not-allowed"
                        >
                            &larr; Previous
                        </button>
                        <span className="font-bold text-gray-700 px-2.5 py-1 bg-gray-100 rounded-md border border-gray-200/50 shadow-inner">
                            {currentPage} <span className="text-gray-400 font-normal">/</span> {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-sm transition-all duration-200 flex items-center gap-1 select-none cursor-pointer disabled:cursor-not-allowed"
                        >
                            Next &rarr;
                        </button>
                    </div>
                )}
            </div>
            {/* harita türkiye merkezli açılıyor */}
            <MapContainer
                center={[39.0, 35.0]}
                zoom={7}
                zoomControl={false}
                preferCanvas={true}
                style={{ height: '100%', width: '100%' }}
                ref={setMap}
                inertia={true}
                inertiaDeceleration={1200}
                inertiaMaxSpeed={3000}
                easeLinearity={0.1}
            >
                <ZoomControl position="bottomright" />
                <TileLayer
                    key={mapStyle}
                    url={MAP_STYLES[mapStyle].url}
                    attribution={MAP_STYLES[mapStyle].attribution}
                    updateWhenZooming={false}
                    keepBuffer={4}
                />
                {/* hybrid uyduya yol ve ad ekliyor  */}
                {mapStyle === 'hybrid' && (
                    <>
                        <TileLayer
                            key="hybrid-roads"
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                            attribution="Tiles &copy; Esri"
                            updateWhenZooming={false}
                            keepBuffer={4}
                            opacity={0.8}
                        />
                        <TileLayer
                            key="hybrid-labels"
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                            updateWhenZooming={false}
                            keepBuffer={4}
                        />
                    </>
                )}
                {/* depremler useMemo ile?  */}
                {markers}
            </MapContainer>
        </div>
    );
}