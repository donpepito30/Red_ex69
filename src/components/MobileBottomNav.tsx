import React, { memo } from 'react';
import { Flame, SlidersHorizontal, Heart, Coins } from 'lucide-react';

interface MobileBottomNavProps {
  onExploreClick: () => void;
  onFilterClick: () => void;
  onFavoritesClick: () => void;
  onTokensClick: () => void;
  favoriteCount: number;
  showFavoritesOnly: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = memo(({
  onExploreClick,
  onFilterClick,
  onFavoritesClick,
  onTokensClick,
  favoriteCount,
  showFavoritesOnly,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-900 h-16 pb-safe flex items-center justify-around md:hidden">
      {/* Tab: Explorar */}
      <button
        onClick={onExploreClick}
        className={`flex-1 h-full flex flex-col items-center justify-center transition-colors min-h-[44px] ${
          !showFavoritesOnly ? 'text-rose-500' : 'text-zinc-400 active:text-white'
        }`}
        aria-label="Explorar transmisiones en vivo"
      >
        <Flame className="w-5 h-5 shrink-0" />
        <span className="text-[10px] font-extrabold tracking-tight mt-1">Explorar</span>
      </button>

      {/* Tab: Filtros */}
      <button
        onClick={onFilterClick}
        className="flex-1 h-full flex flex-col items-center justify-center text-zinc-400 active:text-white transition-colors min-h-[44px]"
        aria-label="Filtros avanzados"
      >
        <SlidersHorizontal className="w-5 h-5 shrink-0" />
        <span className="text-[10px] font-extrabold tracking-tight mt-1">Filtros</span>
      </button>

      {/* Tab: Favoritos */}
      <button
        onClick={onFavoritesClick}
        className={`flex-1 h-full flex flex-col items-center justify-center relative transition-colors min-h-[44px] ${
          showFavoritesOnly ? 'text-rose-500' : 'text-zinc-400 active:text-white'
        }`}
        aria-label="Modelos favoritas"
      >
        <div className="relative">
          <Heart className={`w-5 h-5 shrink-0 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : ''}`} />
          {favoriteCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-rose-600 text-[8px] font-black text-white h-4 w-4 rounded-full flex items-center justify-center shadow">
              {favoriteCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-extrabold tracking-tight mt-1">Favoritas</span>
      </button>

      {/* Tab: Tokens */}
      <button
        onClick={onTokensClick}
        className="flex-1 h-full flex flex-col items-center justify-center text-zinc-400 active:text-amber-400 transition-colors min-h-[44px]"
        aria-label="Comprar Tokens"
      >
        <Coins className="w-5 h-5 shrink-0 text-amber-500" />
        <span className="text-[10px] font-extrabold tracking-tight mt-1">Comprar</span>
      </button>
    </div>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';
