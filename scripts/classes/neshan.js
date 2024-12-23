class Neshan {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = new Headers({
      "Api-Key": this.apiKey,
    });

    // API endpoints
    this.endpoints = {
      reverse: "https://api.neshan.org/v5/reverse",
      geocoding: "https://api.neshan.org/v6/geocoding",
      search: "https://api.neshan.org/v1/search",
    };
  }

  /**
   * تبدیل مختصات به آدرس
   *
   * Reverse geocoding to get address from coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise} Promise object with address data
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `${this.endpoints.reverse}?lat=${lat}&lng=${lng}`;
      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Neshan Reverse response was not ok`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * جستجوی مکان
   *
   * Search for locations by query
   * @param {string} term - Search term
   * @param {number} lat - Latitude for nearby search (optional)
   * @param {number} lng - Longitude for nearby search (optional)
   * @returns {Promise} Promise object with search results
   */
  async search(term, lat = null, lng = null) {
    try {
      let url = `${this.endpoints.search}?term=${encodeURIComponent(term)}`;

      if (lat && lng) {
        url += `&lat=${lat}&lng=${lng}`;
      }

      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error("Neshan Search Response was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * تبدیل آدرس به مختصات
   *
   * Geocode address to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise} Promise object with geocoding results
   */
  async geocode(address) {
    try {
      const url = `${this.endpoints.geocoding}?address=${encodeURIComponent(
        address
      )}`;
      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error("Neshan Geocoding respponse was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
}
