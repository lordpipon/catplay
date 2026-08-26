// src/lib/auth.ts (or your auth config file)
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { db } from './server/db';
import * as schema from './server/db/schema';
import { generateUsername } from './utils/random';
import { uploadProfilePicture } from './server/s3';
import { apiKey } from '@better-auth/api-key';

if (!privateEnv.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set');
if (!privateEnv.GOOGLE_CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET is not set');
if (!publicEnv.PUBLIC_BETTER_AUTH_URL) throw new Error('PUBLIC_BETTER_AUTH_URL is not set');

const DISPOSABLE_DOMAINS = new Set([
	'guerrillamail.com','guerrillamail.de','guerrillamail.net','guerrillamail.org',
	'tempmail.com','temp-mail.org','temp-mail.io','tempmailo.com',
	'tempail.com','tempmailer.com','tempmailer.de','tempinbox.com','tempinbox.co.uk',
	'mailinator.com','maildrop.cc','mailnesia.com','mailnull.com',
	'mohmal.com','10minutemail.com','10minutemail.co.za','minuteinbox.com',
	'getnada.com','getairmail.com','emailondeck.com','33mail.com',
	'yopmail.com','yopmail.fr','dispostable.com','trashmail.com',
	'trashmail.me','trashmail.net','trashmail.org','trashmail.io',
	'guerrillamailblock.com','grr.la','disposableemailaddresses.emailmiser.com',
	'spaml.com','junk1e.com','nowmymail.com','meltmail.com',
	'mailsac.com','fakeinbox.com','sharklasers.com','spam4.me',
	'anonbox.net','binkmail.com','bobmail.info','chacuo.net',
	'developlab.org','discard.email','discardmail.com','discardmail.de',
	'dodgeit.com','dodgit.com','dodgit.org','dontreg.com',
	'dontsendmespam.de','drdrb.com','drdrb.net','droplar.com',
	'dropmail.me','duam.net','dudmail.com','dump-email.info',
	'dumpandjunk.com','dumpmail.de','easytrashmail.com','ee1.pl',
	'ee2.pl','eeloo.com','email-fake.cf','email-fake.com',
	'email-fake.ga','email-fake.gq','email-fake.ml','email-fake.tk',
	'email60.com','emailage.cf','emailage.ga','emailage.gq',
	'emailage.ml','emailage.tk','emaildienst.de','emailgo.de',
	'emailias.com','emailigo.de','emailinfive.com','emaillime.com',
	'emailmiser.com','emailproxsy.com','emails.ga','emailsensei.com',
	'emailsing.com','emailspam.cf','emailspam.ga','emailspam.gq',
	'emailspam.ml','emailspam.tk','emailta.tk','emailtemp.info',
	'emailtemporanea.com','emailtemporanea.net','emailtemporar.ro',
	'emailtemporario.com.br','emailthe.net','emailtmp.com',
	'emailto.de','emailwarden.com','emailx.at.hm','emailxfer.com',
	'emz.net','enterto.com','ephemail.net','etranquil.com',
	'etranquil.net','etranquil.org','evopo.com','explodemail.com',
	'express.net.ua','eyepaste.com','fakeinbox.com','fakeinformation.com',
	'fakemail.fr','fakemailz.com','fammix.com','fansworldwide.de',
	'fantasymail.de','fastacura.com','fastchevy.com','fastchrysler.com',
	'fastkawasaki.com','fastmazda.com','fastmitsubishi.com','fastnissan.com',
	'fastsubaru.com','fastsuzuki.com','fasttoyota.com','fastyamaha.com',
	'fightallspam.com','filzmail.com','fivemail.de','fixmail.tk',
	'fizmail.com','fizmail.hu','flemail.ru','flowu.com',
	'flyspam.com','footard.com','forgetmail.com','fr33mail.info',
	'frapmail.com','freemails.cf','freemails.ga','freemails.ml',
	'freundin.ru','friendlymail.co.uk','front14.org','fuckingduh.com',
	'fudgerub.com','fux0ringduh.com','fyii.de','garliclife.com',
	'gehensiulli.com','get-mail.cf','get-mail.ga','get-mail.ml',
	'get-mail.tk','get1mail.com','get2mail.fr','get2mail.nl',
	'getacinsx.com','getairmail.cf','getairmail.com','getairmail.ga',
	'getairmail.gq','getairmail.ml','getairmail.tk','getamail.biz',
	'getamail.club','getamail.ga','getamail.igg.biz','getamail.info',
	'getamail.us','getapmail.com','getmails.eu','getonemail.com',
	'getonemail.net','ghosttexter.de','girlsundertheinfluence.com',
	'gishpuppy.com','goemailgo.com','gorillaswithdirtyarmpits.com',
	'gotmail.com','gotmail.net','gotmail.org','gowikibooks.com',
	'gowikicampus.com','gowikicars.com','gowikifilms.com',
	'gowikigames.com','gowikimusic.com','gowikinetwork.com',
	'gowikitravel.com','gowikitv.com','grandmamail.com',
	'grandmasmail.com','great-host.in','greensloth.com',
	'greermail.com','guerillamail.biz','guerillamail.com',
	'guerrillamail.biz','guerrillamail.com','guerrillamail.de',
	'guerrillamail.info','guerrillamail.net','guerrillamail.org',
	'h8s.org','hacccc.com','haltospam.com','harakirimail.com',
	'hartbot.de','hat-gansen.de','hatimails.com','helplebian.com',
	'herp.in','hidemail.de','hidemail.us','hidzz.com',
	'hmamail.com','hopemail.biz','hot-mail.cf','hot-mail.ga',
	'hot-mail.gq','hot-mail.ml','hot-mail.tk','hotpop.com',
	'hulapla.de','hushmail.com','ichimail.com','imails.info',
	'inbax.tk','inbox.si','inbox13.com','inbox1st.com',
	'inbox2.info','inboxalias.com','inboxclean.com','inboxclean.org',
	'inboxproxy.com','incognitomail.com','incognitomail.de',
	'incognitomail.net','incognitomail.org','ineec.net','infocom.zp.ua',
	'inoutmail.de','inoutmail.info','inoutmail.net','insorg-mail.info',
	'ipoo.org','irish2me.com','iwi.net','jetable.com',
	'jetable.fr.nf','jetable.net','jetable.org','jnxjn.com',
	'jourrapide.com','jsrsolutions.com','junk1e.com','junkmail.com',
	'junkmail.ga','junkmail.gq','junkmail.ml','kasmail.com',
	'kaspop.com','keepmymail.com','killmail.com','killmail.net',
	'kingsq.ga','kir.ch.tc','klassmaster.com','klassmaster.net',
	'klzlk.com','kook.ml','kurzepost.de','lawlita.com',
	'letthemeatspam.com','lhs.com','lifebyfood.com','link2mail.net',
	'litedrop.com','lol.ovpn.to','lookugly.com','lopl.co.cc',
	'lortemail.dk','lovemeleaveme.com','lr78.com','lroid.com',
	'lukop.dk','m21.cc','maboard.com','mail-temporaire.fr',
	'mail.by','mail.mezimages.net','mail.zp.ua','mail114.net',
	'mail1a.de','mail21.cc','mail2rss.org','mail333.com',
	'mail4t.com','mailbidon.com','mailblocks.com','mailblog.biz',
	'mailbucket.org','mailcat.biz','mailcatch.com','maildrop.cc',
	'maildu.de','maileater.com','mailed.ro','maileimer.de',
	'mailexpire.com','mailfa.tk','mailfor.us','mailfree.ga',
	'mailfree.gq','mailfree.ml','mailfreeonline.com','mailfs.com',
	'mailguard.me','mailhazard.com','mailhazard.us','mailhz.me',
	'mailimate.com','mailinater.com','mailin8r.com','mailinater.com',
	'mailismagic.com','mailmate.com','mailme.ir','mailme.lv',
	'mailme24.com','mailmetrash.com','mailmoat.com','mailnator.com',
	'mailnull.com','mailorg.org','mailpick.biz','mailproxsy.com',
	'mailquack.com','mailrock.biz','mailscrap.com','mailshell.com',
	'mailsiphon.com','mailslite.com','mailtemp.info','mailtothis.com',
	'mailtrash.net','mailtv.net','mailtv.tv','mailwith.me',
	'mailworks.org','mailzilla.com','mailzilla.org','makemetheking.com',
	'manifestgenerator.com','manybrain.com','mbx.cc','mega.zik.dj',
	'megomail.com','meltmail.com','messagebeamer.de','mezimages.net',
	'mfsa.ru','mierdamail.com','migmail.pl','migumail.com',
	'mindless.com','ministry-of-silly-walks.de','mintemail.com',
	'misterpinball.de','mmmmail.com','moatmail.com','mobileninja.co.uk',
	'moburl.com','mohmal.com','moncourrier.fr.emailobfuscator.com',
	'monemail.fr.emailobfuscator.com','monmail.fr.emailobfuscator.com',
	'monumentmail.com','msa.minsmail.com','mt2015.com','mx0.wwwnew.eu',
	'my10minutemail.com','myalias.pw','mycard.net.ua','mycleaninbox.net',
	'myclickemail.com','myemailboxy.com','mymail-in.net',
	'mymailoasis.com','mymailpooch.com','mymailuk.com',
	'mymailvignette.com','mymoomail.com','mynetstore.de',
	'mypacks.net','mypartyclip.de','myphantom.com','mysamp.de',
	'myspaceinc.com','myspaceinc.net','myspaceinc.org',
	'myspacepimpedup.com','mytemp.email','mytempemail.com',
	'mytempmail.com','mythrowaway.email','mytmpemail.com',
	'myunixip.com','nabala.com','neomailbox.com','nepwk.com',
	'netmails.com','netmails.net','neverbox.com','nice-4u.com',
	'nincsmail.hu','nnh.com','no-spam.ws','noblepenguin.com',
	'nonspam.eu','nonspammer.de','noref.in','nospam.ze.tc',
	'nospam4.us','nospamfor.us','nospammail.net','nospamthanks.info',
	'nothingtoseehere.ca','nowmymail.com','nurfuerspam.de',
	'nus.edu.sg','nwldx.com','objectmail.com','obobbo.com',
	'odnorazovoe.ru','oneoffemail.com','onewaymail.com',
	'oopi.org','ordinaryamerican.net','otherinbox.com',
	'ourklips.com','outlawspam.com','ovpn.to','owlpic.com',
	'pancakemail.com','pimpedupmyspace.com','pjjkp.com',
	'plexolan.de','poczta.onet.pl','politikerclub.de',
	'poofy.org','pookmail.com','privacy.net','privatdemail.net',
	'proxymail.eu','prtnx.com','punkass.com','putthisinyouremail.com',
	'qq.com','quickinbox.com','quickmail.nl','rcpt.at',
	'realtyalerts.ca','recode.me','recursor.net','regbypass.com',
	'regbypass.comsafe-mail.net','rejectmail.com','reliable-mail.com',
	'rhyta.com','rklips.com','rmqkr.net','royal.net',
	'rppkn.com','rtrtr.com','s0ny.net','safe-mail.net',
	'safersignup.de','safetymail.info','safetypost.de',
	'sandelf.de','saynotospams.com','scatmail.com','schafmail.de',
	'schnellmail.de','schweiz.org','secretemail.de',
	'secure-mail.biz','sendspamhere.com','shiftmail.com',
	'shittymail.com','shitware.nl','shmeriously.com',
	'shortmail.net','sibmail.com','sinnlos-mail.de',
	'skeefmail.com','slaskpost.se','slipry.net',
	'slopsbox.com','slowslow.de','slutty.horse','smashmail.de',
	'smtp99.com','snakemail.com','sneakemail.com',
	'sneakymail.de','snkmail.com','sofimail.com',
	'sofimail.de','softpls.asia','sogetthis.com',
	'sohudrbc.de','solvemail.info','soodonims.com',
	'spam.la','spam.su','spam4.me','spamavert.com',
	'spambob.com','spambob.net','spambob.org','spambog.com',
	'spambog.de','spambog.ru','spambot007.com',
	'spambox.info','spambox.irishspringrealty.com',
	'spambox.us','spamcannon.com','spamcannon.net',
	'spamcero.com','spamcowboy.com','spamcowboy.net',
	'spamcowboy.org','spamday.com','spamex.com',
	'spamfighter.cf','spamfighter.ga','spamfighter.gq',
	'spamfighter.ml','spamfighter.tk','spamfree.eu',
	'spamfree24.com','spamfree24.de','spamfree24.eu',
	'spamfree24.info','spamfree24.net','spamfree24.org',
	'spamgoes.in','spamgourmet.com','spamgourmet.net',
	'spamgourmet.org','spamherelots.com','spamhereplease.com',
	'spamhole.com','spamify.com','spaminator.de',
	'spamkill.info','spaml.com','spaml.de','spammotel.com',
	'spamobox.com','spamoff.de','spamslicer.com',
	'spamspot.com','spamstack.net','spamthis.co.uk',
	'spamthisplease.com','spamtrail.com','spamtrap.ro',
	'speed.1s.fr','supergreatmail.com','supermailer.jp',
	'superram.com','superstachel.de','suremail.info',
	'svk.jp','sweetxxx.de','sweetmail.net',
	't2mail.com','talkinator.com','tapchicuoihoi.com',
	'tbprofitsg.ru','tdf-akademie.de','technoprocenter.com',
	'temp-mail.org','temp-mail.ru','temp-note.com',
	'tempail.com','tempalias.com','tempenv.com',
	'tempester.com','tempemail.biz','tempemail.co.za',
	'tempemail.com','tempemail.net','tempemail.org',
	'tempmailer.com','tempmailer.de','tempomail.fr',
	'temporarioemail.com','temporarily.de','temporarioemail.com',
	'temporaryemail.net','temporaryemail.org',
	'temporaryforwarding.com','temporaryinbox.com',
	'temporarymail.net','temporarymailaddress.com',
	'tempthe.net','tempmail.eu','tempmail.it',
	'tempmail2.com','tempmaildemo.com','tempmailer.com',
	'tempmailer.org','tempoemail.com','tempomail.fr',
	'temporary-inbox.com','temporaryemail.com',
	'temporaryemail.us','temporaryforwarding.com',
	'temporaryinbox.com','temporarymailaddress.com',
	'tempthe.net','test.com','thankyou2010.com',
	'thc.st','thcmail.ru','thecloudindex.com',
	'thinking.to','tilien.com','tittbit.in',
	'tizi.com','tmailinator.com','toiea.com',
	'toled.com','toomail.biz','topranklist.de',
	'tradermail.info','trash-amil.com','trash-mail.at',
	'trash-mail.com','trash-mail.de','trash-mail.fr',
	'trash-mail.gq','trash-mail.info','trash-mail.net',
	'trash-mail.org','trash80.com','trashdevil.com',
	'trashdevil.de','trashemail.de','trashmail.at',
	'trashmail.com','trashmail.de','trashmail.me',
	'trashmail.net','trashmail.org','trashmail.ws',
	'trashmailer.com','trashmailer.net','trashymail.com',
	'trashymail.net','trbvm.com','trbvo.com',
	'trickmail.net','truman-post.com','truths4all.com',
	'trymy.email','trythisemail.com','turl.fr',
	'tutka.info','twinmail.de','tyldd.com',
	'uggsrock.com','umail.net','upliftnow.com',
	'uplipht.com','venompen.com','veryreally',
	'viditag.com','viewcastmedia.com','viewcastmedia.net',
	'viewcastmedia.org','vomoto.com','vpn.st',
	'vsimcard.com','vubby.com','wasteland.rfc822.org',
	'webemail.me','weg-werf-email.de','wegwerfadresse.de',
	'wegwerfemail.com','wegwerfemail.de','wegwerfmail.de',
	'wegwerfmail.net','wegwerfmail.org','wegwerfmail24.de',
	'wegwerfemailaddress.com','wegwerfemailauf.de',
	'wegwerfemailbrief.de','wegwerfmailbox.de',
	'wegwerfmailing.de','wegwerfmailnet.de',
	'wegwerfmailpostfach.de','wegwerfsmail.de',
	'wh4f.org','whatiaas.com','whatpaas.com',
	'whyspam.me','wikidocuslice.com','wilemail.com',
	'willhackforfood.biz','willselfdestruct.com',
	'winemaven.info','wronghead.com','wuzup.net',
	'wuzupmail.net','wwwnew.eu','xagloo.com',
	'xemaps.com','xents.com','xjoi.com',
	'xmaily.com','xoxy.net','ycare.de',
	'yeah.net','yep.it','yogamaven.com',
	'yomail.info','yopmail.com','yopmail.fr',
	'you-spam.com','ypmail.webarnak.fr','yuurok.com',
	'zehnminutenmail.de','zippymail.info','zoaxe.com',
	'zoemail.org','guerrillamail.com','tempmail.com',
	'mailinator.com','yopmail.com','guerrillamail.de',
	'tempmailo.com','guerrillamailblock.com',
	'grr.la','sharklasers.com','discard.email',
	'trashmail.com','temp-mail.org','10minutemail.com',
	'maildrop.cc','getnada.com','emailondeck.com',
	'fakeinbox.com','discardmail.com','dispostable.com',
	'guerrillamail.net','guerrillamail.org','tempail.com',
	'yeucvuihen.com','vudewapit.com','worufasu.com',
	'test.com'
]);

function isDisposableEmail(email: string): boolean {
	const domain = email.split('@')[1]?.toLowerCase();
	if (!domain) return false;
	return DISPOSABLE_DOMAINS.has(domain);
}

export const auth = betterAuth({
	//    baseURL: publicEnv.PUBLIC_BETTER_AUTH_URL,
	secret: privateEnv.PRIVATE_BETTER_AUTH_SECRET,
	appName: 'Catplay',

	trustedOrigins: [
		publicEnv.PUBLIC_BETTER_AUTH_URL,
		'https://catplay.org',
		'http://catplay.org',
		'https://catplay.dpdns.org',
		'http://catplay.dpdns.org',
		'http://localhost:5173',
		'http://localhost:4173'
	],

	plugins: [
		apiKey({
			defaultPrefix: 'ctpl_',
			rateLimit: {
				enabled: true,
				timeWindow: 1000 * 60 * 60 * 24, // 1 day
				maxRequests: 2000 // 2000 requests per day
			},
			permissions: {
				defaultPermissions: {
					api: ['read']
				}
			}
		})
	],
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8
	},
	databaseHooks: {
		user: {
			create: {
				before: async (userData) => {
					if (!('username' in userData) || !userData.username) {
						userData = { ...userData, username: generateUsername() };
					}
					const email = (userData as any).email as string | undefined;
					if (email && isDisposableEmail(email)) {
						throw new Error('Disposable email addresses are not allowed');
					}
					return { data: userData };
				}
			}
		}
	},
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: schema
	}),
	socialProviders: {
		google: {
			clientId: privateEnv.GOOGLE_CLIENT_ID,
			clientSecret: privateEnv.GOOGLE_CLIENT_SECRET,
			redirectURI: `${publicEnv.PUBLIC_BETTER_AUTH_URL}/api/auth/callback/google`, //ADDED!!
			mapProfileToUser: async (profile) => {
				const newUsername = generateUsername();
				let s3ImageKey: string | null = null;

				if (profile.picture) {
					try {
						const response = await fetch(profile.picture);
						if (!response.ok) {
							console.error(`Failed to fetch profile picture: ${response.statusText}`);
						} else {
							const blob = await response.blob();
							const arrayBuffer = await blob.arrayBuffer();
							s3ImageKey = await uploadProfilePicture(
								profile.sub,
								new Uint8Array(arrayBuffer),
								blob.type || 'image/jpeg'
							);
						}
					} catch (error) {
						console.error('Failed to upload profile picture during social login:', error);
					}
				}

				return {
					name: profile.name,
					email: profile.email,
					image: s3ImageKey,
					username: newUsername
				};
			}
		}
	},
	user: {
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true
		},
		additionalFields: {
			username: { type: 'string', required: false, input: false },
			isBanned: { type: 'boolean', required: false, input: false },
			banReason: { type: 'string', required: false, input: false },
			baseCurrencyBalance: { type: 'string', required: false, input: false },
			bio: { type: 'string', required: false },
			volumeMaster: { type: 'string', required: false, input: false },
			volumeMuted: { type: 'boolean', required: false, input: false }
		}
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5
		}
	},
	advanced: {
		database: {
			generateId: false
		}
	}
});
