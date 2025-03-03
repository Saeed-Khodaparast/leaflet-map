class OfflineMapManager {
  constructor(options = {}) {
    this.options = {
      dbName: "offlineMapDB",
      storeName: "tiles",
      dbVersion: 1,
      minZoom: 12,
      maxZoom: 16,
      tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      subdomains: ["a", "b", "c"],
      downloadDelay: 100,
      offlineOnly: false,
      ...options,
    };

    this.db = null;
    this.map = null;
    this.tileLayer = null;

    this.events = {
      onProgress: null,
      onComplete: null,
      onError: null,
      onMissingTile: null,
    };

    this.initDB();
  }

  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.options.dbName,
        this.options.dbVersion
      );

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.options.storeName)) {
          db.createObjectStore(this.options.storeName);
        }
      };
    });
  }

  // Add this method to check if DB is ready
  async waitForDB() {
    if (this.db) return;

    let attempts = 0;
    const maxAttempts = 10;

    while (!this.db && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.db) {
      throw new Error("Database failed to initialize");
    }
  }

  // Modify init method to ensure DB is ready
  async init(map) {
    await this.waitForDB();
    this.map = map;
    this.tileLayer = this.createOfflineTileLayer();
    this.tileLayer.addTo(map);

    if (this.options.showUI) {
      await this.createUI();
    }

    this.createOfflineToggle();
  }

  // Modify createUI method to handle async operations
  async createUI() {
    this.createDownloadButton();
    await this.createCacheInfo();
  }

  // Modified createOfflineTileLayer method
  createOfflineTileLayer() {
    const CustomTileLayer = L.TileLayer.extend({
      getTileUrl: function (coords) {
        return this._url
          .replace(
            "{s}",
            this.options.subdomains[
              Math.floor(Math.random() * this.options.subdomains.length)
            ]
          )
          .replace("{z}", coords.z)
          .replace("{x}", coords.x)
          .replace("{y}", coords.y);
      },

      createTile: function (coords, done) {
        const tile = document.createElement("img");
        tile.setAttribute("role", "presentation");

        const loadTile = async () => {
          try {
            const cachedTile = await this._offlineManager.getTile(
              coords.x,
              coords.y,
              coords.z
            );
            if (cachedTile) {
              tile.src = cachedTile;
              done(null, tile);
            } else if (this._offlineManager.options.offlineOnly) {
              this._offlineManager.createPlaceholderTile(tile, coords, done);
            } else {
              tile.crossOrigin = "anonymous";
              tile.addEventListener("load", () => {
                done(null, tile);
              });
              tile.addEventListener("error", (e) => {
                done(e, tile);
              });
              tile.src = this.getTileUrl(coords);
            }
          } catch (error) {
            console.error("Tile loading error:", error);
            this._offlineManager.createPlaceholderTile(tile, coords, done);
          }
        };

        loadTile();
        return tile;
      },
    });

    const tileLayer = new CustomTileLayer(this.options.tileUrl, {
      maxZoom: this.options.maxZoom,
      minZoom: this.options.minZoom,
      subdomains: this.options.subdomains,
      attribution: "© OpenStreetMap contributors",
    });

    // Add reference to OfflineMapManager
    tileLayer._offlineManager = this;

    return tileLayer;
  }

  createPlaceholderTile(tile, coords, done) {
    if (this.events.onMissingTile) {
      this.events.onMissingTile(coords);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#ddd";
    ctx.strokeRect(0, 0, 256, 256);
    tile.src = canvas.toDataURL();
    done(null, tile);
  }

  loadOnlineTile(tile, coords, done) {
    const url = this.options.tileUrl
      .replace(
        "{s}",
        this.options.subdomains[
          Math.floor(Math.random() * this.options.subdomains.length)
        ]
      )
      .replace("{z}", coords.z)
      .replace("{x}", coords.x)
      .replace("{y}", coords.y);

    tile.crossOrigin = "anonymous";
    tile.onload = () => done(null, tile);
    tile.onerror = (e) => done(e, tile);
    tile.src = url;
  }

  // IndexedDB operations
  async setTile(x, y, z, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.options.storeName],
        "readwrite"
      );
      const store = transaction.objectStore(this.options.storeName);
      const request = store.put(data, this.getTileKey(x, y, z));

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTile(x, y, z) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.options.storeName],
        "readonly"
      );
      const store = transaction.objectStore(this.options.storeName);
      const request = store.get(this.getTileKey(x, y, z));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Modified clearCache method
  async clearCache() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(
        [this.options.storeName],
        "readwrite"
      );
      const store = transaction.objectStore(this.options.storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async getCacheSize() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(
        [this.options.storeName],
        "readonly"
      );
      const store = transaction.objectStore(this.options.storeName);
      const request = store.getAll(); // Get all records

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        let totalSize = 0;
        const tiles = request.result;

        // Calculate size of all tiles
        tiles.forEach((tile) => {
          totalSize += this.getStringBytes(tile);
        });

        // Convert to MB
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        resolve(sizeMB);
      };
    });
  }

  getTileKey(x, y, z) {
    return `${z}/${x}/${y}`;
  }

  // Download area
  async downloadArea(bounds) {
    const tiles = this.calculateTiles(bounds);
    const total = tiles.length;
    let completed = 0;

    console.log(`Starting download of ${total} tiles...`);

    for (const tile of tiles) {
      try {
        await this.downloadTile(tile);
        completed++;

        if (this.events.onProgress) {
          this.events.onProgress(completed, total);
        }

        await new Promise((resolve) =>
          setTimeout(resolve, this.options.downloadDelay)
        );
      } catch (error) {
        console.error(`Failed to download tile:`, error);
        if (this.events.onError) {
          this.events.onError(error);
        }
      }
    }

    if (this.events.onComplete) {
      this.events.onComplete();
    }
  }

  // Download single tile
  async downloadTile(tile) {
    const url = this.options.tileUrl
      .replace(
        "{s}",
        this.options.subdomains[
          Math.floor(Math.random() * this.options.subdomains.length)
        ]
      )
      .replace("{z}", tile.z)
      .replace("{x}", tile.x)
      .replace("{y}", tile.y);

    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    await this.setTile(tile.x, tile.y, tile.z, base64);
  }

  // Calculate required tiles for an area
  calculateTiles(bounds) {
    let tiles = [];
    for (let z = this.options.minZoom; z <= this.options.maxZoom; z++) {
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();

      const neTile = this.latLngToTile(northEast.lat, northEast.lng, z);
      const swTile = this.latLngToTile(southWest.lat, southWest.lng, z);

      for (let x = swTile.x; x <= neTile.x; x++) {
        for (let y = neTile.y; y <= swTile.y; y++) {
          tiles.push({ x, y, z });
        }
      }
    }
    return tiles;
  }

  // Utility methods
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  latLngToTile(lat, lng, zoom) {
    return {
      x: Math.floor(((lng + 180) / 360) * Math.pow(2, zoom)),
      y: Math.floor(
        ((1 -
          Math.log(
            Math.tan((lat * Math.PI) / 180) +
              1 / Math.cos((lat * Math.PI) / 180)
          ) /
            Math.PI) /
          2) *
          Math.pow(2, zoom)
      ),
      z: zoom,
    };
  }

  // UI Creation
  createUI() {
    this.createDownloadButton();
    this.createCacheInfo();
  }

  createDownloadButton() {
    const container = document.createElement("div");
    container.className = "leaflet-control-container";
    container.style.cssText =
      "position:absolute;top:10px;right:10px;z-index:1000;";

    const button = document.createElement("button");
    button.className = "offline-map-button";
    button.textContent = "Download Current Area";

    const progress = document.createElement("div");
    progress.className = "offline-map-progress";
    progress.style.display = "none";

    container.appendChild(button);
    container.appendChild(progress);

    button.onclick = async () => {
      const bounds = this.map.getBounds();
      button.disabled = true;
      progress.style.display = "block";

      this.events.onProgress = (completed, total) => {
        progress.textContent = `Downloaded ${completed}/${total} tiles`;
      };

      this.events.onComplete = () => {
        button.disabled = false;
        setTimeout(() => {
          progress.style.display = "none";
        }, 2000);
      };

      await this.downloadArea(bounds);
    };

    this.map.getContainer().appendChild(container);
  }

  // Modified createCacheInfo method
  async createCacheInfo() {
    const container = document.createElement("div");
    container.className = "leaflet-control-container";
    container.style.cssText =
      "position:absolute;bottom:10px;right:10px;z-index:1000;background:white;padding:10px;border-radius:4px;";

    const info = document.createElement("div");
    info.className = "offline-map-info";

    // Initial size display
    const initialSize = await this.getCacheSize();
    info.textContent = `Cache: ${initialSize}MB`;

    const clearButton = document.createElement("button");
    clearButton.className = "offline-map-clear";
    clearButton.textContent = "Clear Cache";

    clearButton.onclick = async () => {
      await this.clearCache();
      const newSize = await this.getCacheSize();
      info.textContent = `Cache: ${newSize}MB`;
    };

    container.appendChild(info);
    container.appendChild(clearButton);
    this.map.getContainer().appendChild(container);

    // Update cache size periodically
    setInterval(async () => {
      const size = await this.getCacheSize();
      info.textContent = `Cache: ${size}MB`;
    }, 5000); // Update every 5 seconds
  }

  // Create offline mode toggle
  createOfflineToggle() {
    const container = document.createElement("div");
    container.className = "leaflet-control-container offline-toggle";
    container.style.cssText =
      "position:absolute;top:10px;left:10px;z-index:1000;";

    const label = document.createElement("label");
    label.className = "switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.options.offlineOnly;

    const slider = document.createElement("span");
    slider.className = "slider";

    label.appendChild(input);
    label.appendChild(slider);
    container.appendChild(label);

    input.addEventListener("change", (e) => {
      this.toggleOfflineMode(e.target.checked);
    });

    this.map.getContainer().appendChild(container);
  }

  // Toggle between online and offline modes
  toggleOfflineMode(enabled) {
    this.options.offlineOnly = enabled;
    if (this.map && this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = this.createOfflineTileLayer();
      this.tileLayer.addTo(this.map);
    }
  }

  // Helper method to calculate string size in bytes
  getStringBytes(str) {
    if (typeof str !== "string") return 0;
    return new Blob([str]).size;
  }
}
