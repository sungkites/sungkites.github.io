---
layout: default
permalink: /publications/
title: 论文
description: 宋鹏峰的学术论文与预印本，包含期刊原文、arXiv、DOI及公开代码入口。
nav: true
nav_order: 2
---

<link rel="stylesheet" href="{{ '/assets/css/profile.css' | relative_url }}">
<div class="sp-site sp-interior">
  <header class="sp-page-header"><p class="sp-eyebrow">PUBLICATIONS</p><h1>学术论文</h1><p>大语言模型与智能体、多模态理解及机器学习方向的研究工作。</p></header>
  <div class="sp-paper-list">
  {% assign paper_limit = 100 %}
  {% for paper in site.data.profile_publications limit:paper_limit %}
    <article class="sp-paper" aria-labelledby="paper-{{ paper.id }}">
      <div class="sp-paper-meta"><span>{{ paper.topic }}</span><span>{{ paper.venue }} · {{ paper.year }}</span></div>
      <h3 id="paper-{{ paper.id }}"><a href="{{ paper.primary_url }}" target="_blank" rel="noopener noreferrer">{{ paper.title }}</a></h3>
      <p class="sp-paper-authors">{{ paper.authors }}</p>
      <p class="sp-paper-summary">{{ paper.summary }}</p>
      <div class="sp-paper-links">
        <a href="{{ paper.primary_url }}" target="_blank" rel="noopener noreferrer">{{ paper.primary_label }} <span aria-hidden="true">↗</span></a>
        {% if paper.pdf %}<a href="{{ paper.pdf }}" target="_blank" rel="noopener noreferrer">PDF <span aria-hidden="true">↗</span></a>{% endif %}
        {% if paper.code %}<a href="{{ paper.code }}" target="_blank" rel="noopener noreferrer">代码 <span aria-hidden="true">↗</span></a>{% endif %}
        {% if paper.doi_url %}<a href="{{ paper.doi_url }}" target="_blank" rel="noopener noreferrer">DOI <span aria-hidden="true">↗</span></a>{% endif %}
      </div>
      <p class="sp-paper-doi">DOI: {{ paper.doi }}</p>
    </article>
  {% endfor %}
</div>

  <p class="sp-publication-note">预印本与已发表期刊论文在条目中分别标注。部分历史论文的 DOI 暂不能解析，可通过“期刊原文”访问。</p>
</div>
