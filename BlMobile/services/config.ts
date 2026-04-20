import { Platform } from 'react-native';

const ANDROID_LOCAL_API = 'http://10.0.2.2:8000';
const DEFAULT_LOCAL_API = 'http://127.0.0.1:8000';

const fallbackApiUrl = Platform.OS === 'android' ? ANDROID_LOCAL_API : DEFAULT_LOCAL_API;
const envGeneric = process.env.EXPO_PUBLIC_API_URL?.trim();
const envAndroid = process.env.EXPO_PUBLIC_API_URL_ANDROID?.trim();
const envIos = process.env.EXPO_PUBLIC_API_URL_IOS?.trim();

function normalizeAndroidHost(url: string): string {
	if (Platform.OS !== 'android') {
		return url;
	}

	// Android emulator cannot reach host localhost/127.0.0.1 directly.
	return url.replace('://127.0.0.1', '://10.0.2.2').replace('://localhost', '://10.0.2.2');
}

const candidateByPlatform = Platform.select({
	android: envAndroid,
	ios: envIos,
	default: undefined,
});

const envApiUrl = candidateByPlatform || envGeneric;

export const API_BASE_URL =
	envApiUrl && envApiUrl.length > 0 ? normalizeAndroidHost(envApiUrl) : fallbackApiUrl;
