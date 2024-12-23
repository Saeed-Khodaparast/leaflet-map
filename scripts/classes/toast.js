class Toast {
  constructor() {
    this.container = document.querySelector(".toast-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show a toast message
   * @param {string} message - The message to display
   * @param {Object} options - Configuration options
   * @param {string} options.type - Toast type ('success', 'error', 'warning', 'info')
   * @param {number} options.duration - Duration in milliseconds
   */
  show(message, options = {}) {
    const { type = "info", duration = 3000 } = options;

    // Create toast element
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Add to container
    this.container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add("closing");

      // Remove after animation
      setTimeout(() => {
        this.container.removeChild(toast);
      }, 300); // Match animation duration
    }, duration);
  }
}

// Create toast instance
const toast = new Toast();

// Usage examples:
function showToastExamples() {
  // Success toast
  toast.show("Successfully saved!", {
    type: "success",
    duration: 3000,
  });

  // Error toast
  toast.show("An error occurred!", {
    type: "error",
    duration: 4000,
  });

  // Warning toast
  toast.show("Please check your input", {
    type: "warning",
    duration: 3000,
  });

  // Info toast
  toast.show("New message received", {
    type: "info",
    duration: 2000,
  });
}

// Example usage:
// toast.show('Hello World!', { type: 'success' });
