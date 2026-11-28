<script lang="ts">
	import '../app.css';

	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner';

	import MobileTabBar from '$lib/components/self/MobileTabBar.svelte';
	import AppSidebar from '$lib/components/self/AppSidebar.svelte';
	import PasswordSetupPrompt from '$lib/components/self/PasswordSetupPrompt.svelte';

	import { USER_DATA } from '$lib/stores/user-data';
	import { onMount, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { invalidateAll, onNavigate } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { websocketController } from '$lib/stores/websocket';
import { startVipUserPolling } from '$lib/stores/vip-users';
	import { dev } from '$app/environment';
	import { RenderScan } from 'svelte-render-scan';
	import { _ } from 'svelte-i18n';
	import { SITE_NAME } from '$lib/site';
	import QuickJump from '$lib/components/self/QuickJump.svelte';
	import Kbd from '$lib/components/self/Kbd.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Search01Icon } from '@hugeicons/core-free-icons';
	import { isApplePlatform } from '$lib/utils';

	let quickJumpOpen = $state(false);
	let shortcutLabel = $state('Ctrl K');

	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			quickJumpOpen = !quickJumpOpen;
		}
	}

	let { data, children } = $props<{
		data: { userSession?: any };
		children: any;
	}>();

	untrack(() => USER_DATA.set(data?.userSession ?? null));
	$effect(() => {
		USER_DATA.set(data?.userSession ?? null);
	});

	onMount(() => {
		// iOS Safari only applies :active (pressed) styles when some touch listener exists
		const noop = () => {};
		document.addEventListener('touchstart', noop, { passive: true });
		if (isApplePlatform()) shortcutLabel = '⌘K';
		websocketController.connect();
		startVipUserPolling();

		// Register service worker (for web push) silently; no permission prompt here.
		if ('serviceWorker' in navigator && 'PushManager' in window) {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.error('Failed to register service worker:', err);
			});
		}

		console.log(
			`%c                                       .--                    
                                      .=--:                   
                                   :=*#*:                     
                               .=******+#*.                   
                            .+*****+*#*+**#*                  
                          :**++**####*###*++#-                
                        =***+*####******###*+#*               
                      =***++#####***+++***%#*+*%:             
                    =*++*###+=++++====****##%#**#=            
                 .+**+=*##=*###+####*#+++*###%#**#=           
               :#*=**####=*#+-*##=-*##+**#####%##*%=          
     .      :+**++*###***++=*#++=*###**######%%%####:.--:     
    .---=******+*###****=***=-**+##*#+*###%%%***##%%#=--:     
     :-:  =#++**##***+++=******#*=##**#%%%##*#%*:             
           .**++*##***++**+**#*####+*%%#**#%+.                
             +***+##*=**=++******##%%*####:                   
              -#+++###***+*######%####%+                      
               .#*++*##**#####%%#**##=                        
                 *#*+*######%%#*###=                          
                  +#**#%%%%##**##-                            
                   =#***#*###%+.                              
                    -%#####*:                                 
                    .=%#*:                                    
                 .=--=.                                       
                   ::`,
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);
		console.log(
			`%c Welcome to ${SITE_NAME}! DO NOT FUCKING PASTE ANYTHING IN THE CONSOLE UNLESS YOU KNOW WHAT YOU ARE DOING.`,
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);
		console.log(
			'%c A product by Outpoot.com',
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);

		const url = new URL(window.location.href);
		if (url.searchParams.has('signIn')) {
			url.searchParams.delete('signIn');
			window.history.replaceState({}, '', url);
			invalidateAll();
		}

		return () => {
			websocketController.disconnect();
		};
	});

	function getPageTitle(routeId: string | null): string {
		if (!routeId) return SITE_NAME;

		const titleMap: Record<string, string> = {
			'/': $_('page_names.home'),
			'/market': $_('page_names.market'),
			'/portfolio': $_('page_names.portfolio'),
			'/leaderboard': $_('page_names.leaderboard'),
			'/season': $_('page_names.season'),
			'/coin/create': $_('page_names.create_coin'),
			'/settings': $_('page_names.settings'),
			'/admin': $_('page_names.admin.main'),
			'/admin/users': $_('page_names.admin.users') ?? 'User Management',
			'/admin/promo': $_('page_names.admin.promo'),
			'/admin/seasons': $_('page_names.admin.seasons') ?? 'Season Settings',
			'/transactions': $_('page_names.transactions'),
			'/groups': $_('page_names.groups'),
			'/lottery': $_('page_names.lottery'),
			'/hopium': $_('page_names.hopium'),
			'/arcade': $_('page_names.arcade'),
			'/live': $_('page_names.live_trades'),
			'/treemap': $_('page_names.treemap'),
			'/about': $_('page_names.about'),
			'/legal/privacy': 'Privacy Policy',
			'/legal/terms': 'Terms of Service',
			'/shop': $_('page_names.shop'),
			'/achievements': $_('page_names.achievements') ?? 'Achievements',
			'/notifications': $_('page_names.notifications') ?? 'Notifications',
			'/prestige': $_('page_names.prestige') ?? 'Prestige',
			'/api': $_('page_names.api') ?? 'API',
			'/banned': $_('page_names.banned') ?? 'Banned'
		};

		// Handle dynamic routes
		if (routeId.startsWith('/coin/[coinSymbol]')) {
			return 'Coin Details';
		}
		if (routeId.startsWith('/user/[username]')) {
			return 'User Profile';
		}
		if (routeId.startsWith('/hopium/[id]')) {
			return 'Prediction Question';
		}

		return titleMap[routeId] || SITE_NAME;
	}


	let pageHeadingInView = $state(true);
	onMount(() => {
		let frame = 0;
		const check = () => {
			frame = 0;
			const heading = document.querySelector<HTMLElement>('.main-content-area h1');
			pageHeadingInView = !!heading && heading.getBoundingClientRect().bottom > 52;
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(check);
		};
		// Headings often render after data loads
		const content = document.querySelector('.main-content-area');
		const observer = new MutationObserver(schedule);
		if (content) observer.observe(content, { childList: true, subtree: true });
		window.addEventListener('scroll', schedule, { passive: true });
		check();
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', schedule);
			if (frame) cancelAnimationFrame(frame);
		};
	});

	const hasTabBar = new MediaQuery('max-width: 767px', false);
	let toastOffset = $derived(
		hasTabBar.current
			? { top: 'calc(3.5rem + env(safe-area-inset-top))', left: '16px', right: '16px' }
			: undefined
	);

	onNavigate((navigation) => {
		if (
			!document.startViewTransition ||
			navigation.from?.url.pathname === navigation.to?.url.pathname ||
			!window.matchMedia('(max-width: 767px)').matches ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			// A skipped transition still navigates; don't surface it as an error
			transition.ready.catch(() => {});
		});
	});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<QuickJump bind:open={quickJumpOpen} />

<!-- <RenderScan /> -->
<ModeWatcher />
<Toaster
	richColors={true}
	position={hasTabBar.current ? 'top-center' : undefined}
	offset={toastOffset}
	mobileOffset={toastOffset}
/>

<Sidebar.Provider>
	<AppSidebar />
	<PasswordSetupPrompt />

	<Sidebar.Inset class="sidebar-container">
		<header
			style="view-transition-name: mobile-header;"
			class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 max-md:bg-background/90 max-md:supports-[backdrop-filter]:bg-background/75 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height,border-color] ease-linear max-md:sticky max-md:top-0 max-md:z-30 max-md:backdrop-blur {pageHeadingInView
				? 'max-md:border-transparent'
				: ''}"
		>
			<div class="flex w-full items-center gap-4 px-4 lg:px-6">
				<Sidebar.Trigger class="-ml-1 max-md:hidden" />

				<h1
					class="mr-6 min-w-0 truncate text-base font-medium max-md:transition-opacity max-md:duration-200 {pageHeadingInView
						? 'max-md:opacity-0'
						: ''}"
				>
					{getPageTitle(page.route.id)}
				</h1>

				<Button
					variant="outline"
					size="sm"
					class="text-muted-foreground ml-auto h-8 gap-2 px-2 font-normal sm:w-56 sm:justify-start"
					aria-label="Search coins, players and pages"
					onclick={() => (quickJumpOpen = true)}
				>
					<HugeiconsIcon icon={Search01Icon} class="h-4 w-4" />
					<span class="hidden sm:inline">Search...</span>
					<Kbd class="ml-auto hidden sm:inline-flex">{shortcutLabel}</Kbd>
				</Button>
			</div>
		</header>

		<div class="main-content-area max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
			<div class="@container/main flex flex-col gap-2">
				<div class="flex flex-col gap-4 md:gap-6">
					<div class="px-4 md:py-4 lg:px-6">
						{@render children()}
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>

	<MobileTabBar />
</Sidebar.Provider>
