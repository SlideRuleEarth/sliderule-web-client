import Permalink from "ol-ext/control/Permalink";

function isLocalStorageAvailable() {
    try {
        const test = "__test__";
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

export function usePermalink() {
    let plink: Permalink;
    if (isLocalStorageAvailable()) {
        plink = new Permalink({ visible: true, localStorage: 'position' });
        return plink;
    } else {
        console.log("Error:localStorage not available no Permalink control added");
    }
}
