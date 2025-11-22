<template>
  <section class="Home pt-4 sm:pt-6">
    <Alert class="pt-0 pb-2 sm:py-4">
      <AlertTitle class="font-bold hidden sm:flex sm:gap-2">
        <RocketIcon class="h-4 w-4 hidden sm:flex" /> Heads up!
      </AlertTitle>
      <AlertDescription class="p-0 text-xs sm:text-sm">
        <p class="pt-2">无限图片储存数量，你可以上传不限数量的图片！</p>
        <p>图片首次访问后缓存，"永久"有效，包括全球分布的 CDN，以确保尽可能快地提供图像.</p>
        <p>骤雨重山图床 是 <a class="text-slate-400" href="https://www.vvhan.com" target="_blank" title="韩小韩博客">韩小韩博客</a>
          支持并维护的文件上传项目，致力于为用户提供稳定的永久存储服务。</p>
        <p style="font-weight: bold">开源地址: <a class="text-[#0969da]" href="https://github.com/uxiaohan/ZYCS-IMG"
            target="_blank">ZYCS-IMG</a></p>
      </AlertDescription>
    </Alert>

    <!-- 工具栏 -->
    <div class="pt-6 flex items-center text-sm">
      <div class="sync shrink-0">
        <RadioGroup v-model="uploadProvider"
          class="flex items-center gap-4 [&>label]:flex [&>label]:items-center [&>label]:space-x-2 [&>label]:cursor-pointer">
          <Label for="imgur">
            <RadioGroupItem id="imgur" value="imgur" />
            <span>Imgur</span>
          </Label>
          <Label for="oss">
            <RadioGroupItem id="oss" value="oss" />
            <span>OSS</span>
          </Label>
        </RadioGroup>
      </div>
    </div>
    <!-- 上传 -->
    <Upload v-model="fileList" :UploadConfig="UploadConfig" :uploadAPI="uploadAPI" :provider="uploadProvider" />
    <section v-show="fileList.length" class="vh-tools"><Button @click="fileList = []">清空</Button><Button
        @click="vh.CopyText(fileList.map((i: any) => i.upload_blob).join('\n'))">复制全部</Button></section>
    <!-- 展示 -->
    <ResList v-model="fileList" :nodeHost="nodeHost" />
  </section>
</template>
<script setup lang="ts">
import vh from 'vh-plugin';
import { ref, watch, computed } from 'vue';
import { formatURL } from '@/utils/index';
import { Button } from '@/components/ui/button';
import Upload from '@/components/Upload/Upload.vue';
import ResList from '@/components/ResList/ResList.vue';
import { RocketIcon } from '@radix-icons/vue';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
const baseHost = (import.meta.env.VITE_IMG_API_URL || location.origin).replace(/\/$/, '');
// 节点 Host（用于 Imgurl CDN 转发）
const nodeHost = ref<string>(baseHost);
const uploadProvider = ref<'imgur' | 'oss'>('imgur');
// 上传接口
const uploadAPI = computed(() => (uploadProvider.value === 'imgur' ? `${baseHost}/upload` : `${baseHost}/oss/upload`));
// 上传配置
const UploadConfig = computed(() => ({
  AcceptTypes: uploadProvider.value === 'oss' ? '*/*' : 'image/*',
  Max: 0,
  MaxSize: uploadProvider.value === 'oss' ? 30 : 15,
}));
// 上传列表
const fileList = ref<Array<any>>(JSON.parse(localStorage.getItem('zychUpImageList') || '[]'));
watch(fileList, (newVal) => {
  localStorage.setItem(
    'zychUpImageList',
    JSON.stringify(
      newVal
        .filter((i: any) => i.upload_status == 'success')
        .map((i: any) => {
          i.upload_blob = formatURL({ nodeHost: nodeHost.value }, i.upload_result);
          return i;
        }),
    ),
  );
});
</script>

<style scoped lang="less">
@import 'Home.less';
</style>
