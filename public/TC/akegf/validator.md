# AKEGF · 工具認證

認證要求同時支援匯入及匯出 v0.4，並在應用程式內標明版本及 [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) 連結。

使用 AKEGF 的專案可透過 [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls) 申請列入[合作專案](/?plugin=akegf&id=partners)。

將[多角色範例](/plugin/data/akegf/example.json)匯入後再匯出。國服角色須保留三筆、國際服角色一筆；逐筆比對卡池、獲得物、星級、事件類型、毫秒時間與原始流水號。幹員和武器的同號紀錄均須保留，贈送武器仍為 gift_weapon。

## AKEGF 格式校驗工具

貼上 JSON 或選取本機檔案。資料僅在瀏覽器處理；工具會檢查 Schema、重複角色和同類別的重複流水號。/endfield/0/list/1 指第一個角色的第二筆紀錄。
