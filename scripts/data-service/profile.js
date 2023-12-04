import { signOut } from '../auth/auth-operations.js';
import { csrf } from '../auth/csrf.js';
import { keys as headerKeys, values as headerValues, JWT, Organization, Profile, ProfileAttributes} from '../auth/session-keys.js';
import { JWTTokenUrl } from '../urls.js';

const lang = document.querySelector('html').lang;
const origin = 'https://experienceleague.adobe.com/';
const profileUrl = 'api/profile';

let profileData = null;

async function profileAttributes () {
  if (ProfileAttributes in sessionStorage === false) {
    const res = await request(`${origin}${profileUrl}=?${lang}`, {
      credentials: 'include',
      headers: {
        [headerKeys.auth]: sessionStorage.getItem(JWT),
        [headerKeys.accept]: headerValues.json
      },
      method: 'OPTIONS'
    });

    if (res.ok) {
      const data = await res.json();

      sessionStorage.setItem(ProfileAttributes, JSON.stringify(data.data));
    }
  }

  return JSON.parse(sessionStorage.getItem(ProfileAttributes) || '{}');
}

async function profileMerge (arg) {
  const tmp = await adobeIMS.getProfile();

  console.log(tmp, "hello profile");

  return Object.assign({}, tmp, arg, {avatarUrl: adobeIMS.avatarUrl(tmp.userId)});
}

export async function profile (reuse = false, cstream = true, explicit = false) {
  let result = null;

  if (reuse === false) {
    const data = await adobeIMS.getProfile();

    if (data !== null) {
      if (sessionStorage.getItem(JWT) === null) {
        await JWTTokenUrl(data);
      }

      if (profileData === null || explicit) {
        log('Retrieving Experience League profile');
        const res = await request(`${origin}${profileUrl}=?${lang}`, {
          credentials: 'include',
          headers: {
            [headerKeys.auth]: sessionStorage.getItem(JWT),
            [headerKeys.accept]: headerValues.json
          }
        });

        if (res.ok && res.status === 200) {
          const arg = await res.json();

          result = await profileMerge(arg.data);
          profileData = clone(result);

          if (cstream) {
            // createStream();
          }
        } else {
          signOut();
        }
      } else {
        result = clone(profileData);
      }
    } else {
      signOut();
    }
  } else {
    result = clone(profileData);
  }

  if (result !== null) {
    if (Reflect.ownKeys(meta).length === 0) {
      meta = await profileAttributes();
    }

    const keys = ['industryInterests', 'role'],
      complete = Math.ceil(keys.filter(k => result[k].length > 0).length / keys.length * 100);

    sessionStorage.setItem(Ready, complete === 100);
    sessionStorage.setItem(Organization, result.org || '');
    sessionStorage.setItem(Profile, JSON.stringify(result));
    // localStorage.setItem(SolutionLevel, result.level.join(','));
    // localStorage.setItem(SolutionRole, result.role.join(','));
  }

  return result;
}

export async function updateProfile (key, val, replace = false) {
  const data = await profile(false, false, true);
  console.log("hello after profile method");

  if (Reflect.ownKeys(meta).length === 0) {
    meta = await profileAttributes();
    console.log("hello after profile attributes");
  }

  Reflect.ownKeys(data).forEach(i => {
    if (meta.write.includes(i) === false) {
      delete data[i];
    }
  });

  if (override.test(key) || replace === true) {
    data[key] = val;
  } else if (meta.types[key] === 'array') {
    if (data[key] === void 0 || replace === true) {
      data[key] = [val];
    } else if (Array.isArray(data[key]) === false) {
      data[key] = [data[key], val];
    } else {
      (Array.isArray(val) ? val : [val]).forEach(arg => {
        if (data[key].includes(arg) === false) {
          data[key].push(arg);
        } else {
          data[key].splice(data[key].indexOf(arg), 1);
        }
      });
    }
  } else {
    data[key] = val;
  }

  const res = await request(`${origin}${profileUrl}=?${lang}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      authorization: sessionStorage.getItem(JWT),
      accept: 'application/json',
      'content-type': 'application/json-patch+json',
      'x-csrf-token': await csrf(JWTTokenUrl)
    },
    body: JSON.stringify([{op: 'replace', path: `/${key}`, value: data[key]}])
  });

  if (res.ok && res.status < 400) {
    const arg = await res.json();

    profileData = await profileMerge(arg.data);
    await profile(true);
    sessionStorage.setItem(Profile, JSON.stringify(profileData));
  }

  return profileData;
}