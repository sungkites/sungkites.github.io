---
layout: default
title: 首页
permalink: /
description: 宋鹏峰的个人学术网站，关注大语言模型与智能体、多模态图文理解及金融科技与智能系统。
---

<link rel="stylesheet" href="{{ '/assets/css/profile.css' | relative_url }}">
<div class="sp-site">
  <section class="sp-hero" aria-labelledby="profile-name">
    <div class="sp-intro">
      <p class="sp-eyebrow">浙江万里学院 · 信息与智能工程学院</p>
      <h1 id="profile-name">宋鹏峰<span>Pengfeng Song</span></h1>
      <p class="sp-lead">探索智能体记忆与多模态理解，<br>连接算法研究与行业应用。</p>
      <p class="sp-bio">硕士毕业于宁波大学电子与通信工程专业。研究兴趣包括大语言模型与智能体、多模态图文理解、金融科技与智能系统。曾在上海浦东发展银行从事金融软件研发与数据分析，具有金融科技研发与复杂业务系统建设经验。</p>
      <div class="sp-actions">
        <a class="sp-button sp-button-primary" href="#selected-publications">查看代表论文 <span aria-hidden="true">↓</span></a>
        <a class="sp-button" href="mailto:sungkites@163.com">邮件联系</a>
        <a class="sp-text-link" href="https://github.com/sungkites" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </div>
    </div>
    <figure class="sp-portrait">
      <img src="{{ '/assets/img/PengfengSong.jpg' | relative_url }}" width="855" height="1139" alt="宋鹏峰的个人照片" fetchpriority="high" decoding="async">
      <figcaption>Ningbo, Zhejiang, China</figcaption>
    </figure>
  </section>
  <section id="selected-publications" class="sp-section" aria-labelledby="papers-heading">
    <div class="sp-section-header">
      <div><p class="sp-eyebrow">SELECTED RESEARCH</p><h2 id="papers-heading">代表论文</h2></div>
      <a class="sp-text-link" href="{{ '/publications/' | relative_url }}">全部论文 <span aria-hidden="true">↗</span></a>
    </div>
    <div class="sp-paper-list">
  {% assign paper_limit = 2 %}
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

  </section>
  <section class="sp-section" aria-labelledby="research-heading">
    <div class="sp-section-header"><div><p class="sp-eyebrow">RESEARCH INTERESTS</p><h2 id="research-heading">研究方向</h2></div></div>
    <div class="sp-research-grid">
      <article><span class="sp-index">01</span><h3>大语言模型与智能体</h3><p>长期记忆、时序状态跟踪与检索增强，探索智能体在持续交互中理解和使用变化的信息。</p></article>
      <article><span class="sp-index">02</span><h3>多模态图文理解</h3><p>细粒度跨模态语义对齐、图文检索与最优传输，研究视觉与语言之间的结构化关联。</p></article>
      <article><span class="sp-index">03</span><h3>金融科技与智能系统</h3><p>金融软件研发、数据分析与可靠系统应用，连接算法设计、数据建模与工程实现。</p></article>
    </div>
  </section>
  <section class="sp-contact sp-section" aria-labelledby="contact-heading">
    <div><p class="sp-eyebrow">GET IN TOUCH</p><h2 id="contact-heading">交流与合作</h2><p>欢迎围绕智能体记忆、多模态理解与智能系统应用开展学术交流。</p></div>
    <a class="sp-contact-email" href="mailto:sungkites@163.com">sungkites@163.com <span aria-hidden="true">↗</span></a>
  </section>
</div>
