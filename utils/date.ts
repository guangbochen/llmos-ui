import dayjs from 'dayjs'
export function timeAgo(time: string) {
  return dayjs(time).fromNow()
}