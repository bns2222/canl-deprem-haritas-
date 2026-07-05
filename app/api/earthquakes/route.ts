import { NextResponse } from 'next/server';

export async function GET() {
    // Create an AbortController with a 6-second timeout to prevent indefinite hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`USGS API returned status: ${response.status}`);
        }

        const data = await response.json();

        const features = (data.features || []).map((quake: any) => {
            const coordinates = quake.geometry?.coordinates || [0, 0, 0];
            const lng = coordinates[0];
            const lat = coordinates[1];
            const depth = coordinates[2] || 0;

            return {
                id: quake.id,
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat, depth]
                },
                properties: {
                    mag: quake.properties?.mag ?? 0.0,
                    place: quake.properties?.place ?? 'Unknown Location',
                    time: quake.properties?.time ?? Date.now(),
                    depth: depth,
                    id: quake.id
                }
            };
        });

        return NextResponse.json({ features });
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('USGS Fetch Error:', error);
        
        // Return 500 with detailed error message
        return NextResponse.json(
            { 
                error: 'Failed to fetch earthquake data from USGS.',
                details: error.name === 'AbortError' ? 'USGS API request timed out.' : error.message
            },
            { status: 500 }
        );
    }
}