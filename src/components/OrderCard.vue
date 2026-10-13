<script setup lang="ts">
import { ChevronRight, Footprints } from "lucide-vue-next";
import type { Order } from "../domain/types";
import { rupiah, dateTime, orderStatus } from "../domain/business";
defineProps<{ order: Order }>();
</script>
<template>
  <RouterLink :to="'/orders/' + order.id" class="order-row">
    <span class="order-symbol"><Footprints :size="20" /></span>
    <span class="order-identity"
      ><strong>{{ order.customerName }}</strong
      ><small
        >{{ order.number }} <span class="dot">·</span>
        {{ order.itemCount }} pasang</small
      ></span
    >
    <span class="order-date"
      ><small>Masuk</small>{{ dateTime(order.createdAt) }}</span
    >
    <span class="order-progress"
      ><span
        class="badge"
        :class="{
          green: order.allReady,
          neutral: order.collected || order.cancelled,
        }"
        >{{ orderStatus(order) }}</span
      ></span
    >
    <span class="order-money"
      ><strong>{{ rupiah(order.total) }}</strong
      ><small :class="{ 'text-orange': order.balance > 0 }">{{
        order.balance > 0 ? "Sisa " + rupiah(order.balance) : "Lunas"
      }}</small></span
    >
    <ChevronRight :size="18" class="muted" />
  </RouterLink>
</template>
