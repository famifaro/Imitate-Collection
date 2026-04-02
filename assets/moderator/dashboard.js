(function(){
  function buildRecentSeries(dailyData, days){
    const today=new Date();
    const rows=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(today);
      d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      rows.push({
        key,
        label:key.slice(5),
        value:Number(dailyData[key]||0),
      });
    }
    return rows;
  }

  function renderChart(series, color){
    const maxValue=Math.max(1,...series.map((item)=>item.value));
    const axisEvery=Math.max(1,Math.ceil(series.length/5));
    return `
      <div class="dashboard-chart">
        <div class="dashboard-chart__bars">
          ${series.map((item)=>`
            <div class="dashboard-chart__bar-col" title="${item.label}: ${item.value}">
              <div class="dashboard-chart__bar-wrap">
                <div
                  class="dashboard-chart__bar"
                  style="background:${color};height:${Math.round(item.value/maxValue*100)}%;min-height:${item.value>0?2:0}px;"
                ></div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dashboard-chart__axis">
          ${series.map((item,index)=>`
            <div class="dashboard-chart__axis-cell${index%axisEvery===0?'':' dashboard-chart__axis-cell--empty'}">${item.label}</div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderMetricCard(card){
    const accent=card.accent?` style="color:${card.accent};"`:'';
    return `
      <article class="dashboard-card">
        <div class="dashboard-card__value"${accent}>${card.value}</div>
        <div class="dashboard-card__label">${card.label}</div>
      </article>
    `;
  }

  function renderMetricSection(cards){
    return `
      <section class="dashboard-grid dashboard-grid--metrics">
        ${cards.map(renderMetricCard).join('')}
      </section>
    `;
  }

  function renderTable(headers, rows, emptyMessage){
    if(!rows.length){
      return `
        <div class="tbl-wrap">
          <div class="dashboard-empty">${emptyMessage}</div>
        </div>
      `;
    }
    return `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>${headers.map((label)=>`<th>${label}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((cells)=>`<tr>${cells.map((cell)=>`<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function formatPercent(numerator, denominator){
    if(!denominator)return '0%';
    return `${Math.round(numerator/denominator*100)}%`;
  }

  function renderDashboard(options){
    const {
      statsMount,
      bottomMount,
      songs,
      tags,
      reports,
      stats,
      remoteSongsUpdatedAt,
      accessData,
      dailyClicks,
      uidDaily,
      escH,
    }=options;

    const taggedCount=Object.keys(tags).length;
    const openReports=reports.filter((report)=>!report.resolved).length;
    const summary=stats?.summary||{};
    const ym=new Date().toISOString().slice(0,7);
    const monthlyAccess=accessData.monthly?.[ym]||0;
    const monthlyUnique=Object.keys(accessData.uid_monthly?.[ym]||{}).length;
    const monthlyClicks=Object.entries(dailyClicks)
      .filter(([key])=>key.startsWith(ym))
      .reduce((sum,[,value])=>sum+Number(value||0),0);
    const totalAccess=accessData.total||0;
    const totalUnique=Object.keys(accessData.uid_total||{}).length;
    const totalClicks=Object.values(dailyClicks).reduce((sum,value)=>sum+Number(value||0),0);

    const dailyUnique={};
    Object.entries(uidDaily).forEach(([day,uids])=>{
      dailyUnique[day]=Object.keys(uids||{}).length;
    });

    const latestUsers=(stats?.latestUsers||[]).map((user)=>[
      escH(user.displayName||user.username||user.id),
      `<span style="font-family:'Space Mono',monospace;font-size:10px;">${escH(user.id)}</span>`,
      user.createdAt?new Date(user.createdAt).toLocaleString('ja-JP'):'-',
    ]);

    const categoryCounts={};
    songs.forEach((song)=>{
      if(song.category)categoryCounts[song.category]=(categoryCounts[song.category]||0)+1;
    });
    const categoryRows=Object.entries(categoryCounts)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(([category,count])=>{
        const taggedInCategory=Object.keys(tags).filter((videoId)=>{
          const song=songs.find((item)=>item.videoId===videoId);
          return song?.category===category;
        }).length;
        return [
          escH(category),
          String(count),
          `${taggedInCategory} (${formatPercent(taggedInCategory,count)})`,
        ];
      });

    const statusRows=[
      ['楽曲最終更新', escH(remoteSongsUpdatedAt?new Date(remoteSongsUpdatedAt).toLocaleString('ja-JP'):'未取得')],
      ['タグ済み率', formatPercent(taggedCount,songs.length)],
      ['未処理報告率', formatPercent(openReports,reports.length)],
      ['登録ユーザー比BAN率', formatPercent(summary.bannedUsers||0,summary.usersTotal||0)],
    ];

    const metricSections=[
      [
        {label:'タグ登録済み楽曲', value:String(taggedCount), accent:'#22c55e'},
        {label:'タグ未登録楽曲', value:String(songs.length-taggedCount), accent:'var(--tx3)'},
        {label:'未処理の報告', value:String(openReports), accent:'#f87171'},
      ],
      [
        {label:'月間アクセス数', value:String(monthlyAccess)},
        {label:'月間ユニーク数', value:String(monthlyUnique)},
        {label:'月間リンククリック', value:String(monthlyClicks)},
      ],
      [
        {label:'月間ログイン数', value:String(summary.monthlyLogins||0)},
        {label:'月間ログインユーザー数', value:String(summary.monthlyActiveUsers||0)},
        {label:'有効セッション数', value:String(summary.currentSessions||0)},
      ],
      [
        {label:'累計アクセス数', value:String(totalAccess)},
        {label:'累計ユニーク数', value:String(totalUnique)},
        {label:'累計リンククリック', value:String(totalClicks)},
      ],
      [
        {label:'累計ログイン数', value:String(summary.totalLogins||0)},
        {label:'登録ユーザー数', value:String(summary.usersTotal||0)},
        {label:'BANユーザー数', value:String(summary.bannedUsers||0)},
      ],
    ];

    const chartSections=[
      [
        {title:'日別アクセス数（14日）', color:'#4d94ff', series:buildRecentSeries(accessData.daily||{},14)},
        {title:'日別ユニーク数（14日）', color:'#4ade80', series:buildRecentSeries(dailyUnique,14)},
        {title:'日別クリック数（14日）', color:'#fbbf24', series:buildRecentSeries(dailyClicks,14)},
      ],
      [
        {
          title:'日別ログイン数（30日）',
          color:'#f472b6',
          series:buildRecentSeries(
            Object.fromEntries((stats?.dailyLogins||[]).map((row)=>[row.day,row.count])),
            30
          ),
        },
        {
          title:'日別ログインユーザー数（30日）',
          color:'#22c55e',
          series:buildRecentSeries(
            Object.fromEntries((stats?.dailyActiveUsers||[]).map((row)=>[row.day,row.count])),
            30
          ),
        },
        {
          title:'新規ユーザー',
          table:renderTable(
            ['新規ユーザー','ユーザーID','登録日時'],
            latestUsers,
            'まだユーザーがいません'
          ),
        },
      ],
    ];

    statsMount.innerHTML=`
      <div class="dashboard-shell">
        <section class="dashboard-grid dashboard-grid--hero">
          <article class="dashboard-hero">
            <div class="dashboard-hero__value">${songs.length}</div>
            <div class="dashboard-hero__label">登録動画数</div>
          </article>
        </section>
        ${metricSections.map(renderMetricSection).join('')}
        ${chartSections.map((charts)=>`
          <section class="dashboard-grid dashboard-grid--charts">
            ${charts.map((chart)=>chart.table?`
              <article class="dashboard-block">
                <div class="dashboard-section-title">${chart.title}</div>
                ${chart.table}
              </article>
            `:`
              <article class="dashboard-block dashboard-chart-card">
                <div class="dashboard-section-title">${chart.title}</div>
                ${renderChart(chart.series, chart.color)}
              </article>
            `).join('')}
          </section>
        `).join('')}
      </div>
    `;

    bottomMount.innerHTML=`
      <section class="dashboard-grid dashboard-grid--bottom">
        <article class="dashboard-block">
          ${renderTable(['カテゴリ','楽曲数','タグ済み'], categoryRows, 'カテゴリ情報がありません')}
        </article>
        <article class="dashboard-block">
          ${renderTable(['キャッシュ状態','値'], statusRows, '状態情報がありません')}
        </article>
      </section>
    `;
  }

  window.moderatorDashboard={renderDashboard};
})();
