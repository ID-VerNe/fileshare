import React from 'react';

interface AdminPanelProps {
  onClose: () => void;
  newShare: any;
  setNewShare: (share: any) => void;
  onSaveShare: () => void;
  adminList: any[];
  onEditShare: (item: any) => void;
  onDeleteShare: (code: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  onClose,
  newShare,
  setNewShare,
  onSaveShare,
  adminList,
  onEditShare,
  onDeleteShare
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">短码管理后台</h2>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-500 text-white rounded-md text-sm md:text-base font-bold shadow-md hover:bg-slate-600 transition-all"
          >
            退出
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-lg shadow-md mb-8">
          <h3 className="text-lg font-bold mb-4 dark:text-white">新增/编辑分享码</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <input 
                placeholder="短码 (如: J2B5hPdT)"
                className="flex-1 p-2 border rounded dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                value={newShare.short_code}
                onChange={e => setNewShare({...newShare, short_code: e.target.value})}
              />
              <button 
                onClick={() => {
                  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                  let result = '';
                  for (let i = 0; i < 10; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                  }
                  setNewShare({...newShare, short_code: result});
                }}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-600 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-xs font-bold"
                title="生成随机短码"
              >
                生成
              </button>
            </div>
            <input 
              placeholder="真实 ItemID"
              className="p-2 border rounded dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              value={newShare.item_id}
              onChange={e => setNewShare({...newShare, item_id: e.target.value})}
            />
            <input 
              placeholder="描述"
              className="p-2 border rounded dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              value={newShare.description}
              onChange={e => setNewShare({...newShare, description: e.target.value})}
            />
            <div className="flex items-center gap-2">
              <label className="dark:text-white text-sm font-medium">允许上传</label>
              <input 
                type="checkbox"
                className="w-4 h-4 text-primary rounded focus:ring-primary"
                checked={!!newShare.allow_upload}
                onChange={e => setNewShare({...newShare, allow_upload: e.target.checked ? 1 : 0})}
              />
            </div>
          </div>
          <button 
            onClick={onSaveShare}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-md w-full font-bold shadow-lg hover:brightness-110 active:scale-[0.99] transition-all"
          >
            保存分享码
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="p-4">短码</th>
                  <th className="p-4">ItemID (缩略)</th>
                  <th className="p-4">描述</th>
                  <th className="p-4 text-center">上传</th>
                  <th className="p-4 text-center">访问</th>
                  <th className="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {adminList.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-primary">{item.short_code}</td>
                    <td className="p-4 truncate max-w-[100px]" title={item.item_id}>{item.item_id}</td>
                    <td className="p-4">{item.description}</td>
                    <td className="p-4 text-center">{item.allow_upload ? '✅' : '❌'}</td>
                    <td className="p-4 text-center font-bold">{item.visit_count}</td>
                    <td className="p-4 flex gap-3">
                      <button 
                        onClick={() => onEditShare(item)}
                        className="text-blue-500 hover:underline font-bold"
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => onDeleteShare(item.short_code)}
                        className="text-red-500 hover:underline font-bold"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;