import { defineStore } from "pinia";
import { useManagementStore } from "@/stores/steve";

export const useContext = defineStore("context", {
  state: () => {
    return {
      mgmtSetup: false,
      namespace: ""
    };
  },

  getters: {
    baseUrl: () => {
      let base = ''

      if ( process.server ) {
        const headers = useRequestHeaders()

        base = `http://${ headers.host }`
      }

      base += '/v1'

      return base
    },

    managerDomain: () => {
      const config = useRuntimeConfig()
      let domain = ''

      if ( typeof window !== 'undefined') {
        domain = window?.location?.origin
      }

      if ( domain.includes('localhost') || domain.includes('127.0.0') || domain.includes('0.0.0.0') ) {
        domain = config.public.api
      }

      domain = domain.replace(/^https?:\/\//, '')

      return domain
    },
  },

  actions: {
    async loadManagement() {
      if (this.mgmtSetup) {
        return;
      }

      this.mgmtSetup = true;
      const mgmt = useManagementStore();
      mgmt.configure(this.baseUrl)
      mgmt.subscribe()

      await mgmt.loadSchemas();
    },
  },
});