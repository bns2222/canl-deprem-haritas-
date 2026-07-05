'use client';
import dynamic from 'next/dynamic';

// Leaflet kütüphanesinin sunucuda çalışmak istemiyor
// Bu yüzden haritamızı standart şekilde değil, "Sadece ekranda (client) yükle" emriyle çağırıyoruz. SSR (Server-Side  Rendering)
const DynamicMap = dynamic(() => import('../components/Map'), {
  ssr: false
});

export default function Home() {
  return (
    <main>
      <DynamicMap />
    </main>
  );
}
