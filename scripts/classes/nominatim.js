class Nominatim {
  constructor() {
    // API endpoints
    this.endpoints = {
      reverse: "https://nominatim.openstreetmap.org/reverse",
      search: "https://nominatim.openstreetmap.org/search",
    };

    // Default headers
    this.headers = new Headers({
      Accept: "application/json",
      "User-Agent": "YourAppName", // Replace with your application name
    });
  }

  /**
   * تبدیل مختصات به آدرس
   *
   * Reverse geocoding to get address from coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} format - Response format (default: 'json')
   * @returns {Promise} Promise object with address data
   */
  async reverseGeocode(lat, lng, format = "json") {
    try {
      const url = `${this.endpoints.reverse}?lat=${lat}&lon=${lng}&format=${format}`;

      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error("Nominatim Reverse Response was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * جستجوی آدرس
   *
   * Search for locations by query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise} Promise object with search results
   */
  async search(query, options = {}) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: options.limit || 10,
        ...options,
      });

      const url = `${this.endpoints.search}?${params.toString()}`;

      const response = await fetch(url, {
        headers: this.headers,
        // Add delay to respect usage policy
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Nominatim search error:", error);
      throw error;
    }
  }

  /**
   * بررسی قرار داشتن در کشور مشخص
   *
   * Check if coordinates are within a specific country
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} countryCode - ISO 3166-1 alpha-2 country code
   * @returns {Promise<boolean>} Promise that resolves to true if coordinates are in the specified country
   */
  async checkCountry(lat, lng, countryCode) {
    try {
      const data = await this.reverseGeocode(lat, lng);
      return data?.address?.country_code === countryCode.toLowerCase();
    } catch (error) {
      throw error;
    }
  }
}
