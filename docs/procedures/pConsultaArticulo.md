# SP: pConsultaArticulo
**Tipo**: Procedimiento
**Módulo**: Inventario

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pConsultaArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pConsultaArticulo] 
AS 
    BEGIN
       SELECT [co_art]
      ,[fecha_reg]
      ,[art_des]
      ,[tipo]
      ,[anulado]
      ,[fecha_inac]
      ,[co_lin]
      ,[co_subl]
      ,[co_cat]
      ,[co_color]
      ,[co_ubicacion]
      ,[cod_proc]
      ,[item]
      ,[modelo]
      ,[ref]
      ,[generico]
      ,[maneja_serial]
      ,[maneja_lote]
      ,[maneja_lote_venc]
      ,[margen_min]
      ,[margen_max]
      ,[tipo_imp]
      ,[co_reten]
      ,[garantia]
      ,[volumen]
      ,[peso]
      ,[stock_min]
      ,[stock_max]
      ,[stock_pedido]
      ,[relac_unidad]
      ,[punt_ven]
      ,[punt_cli]
      ,[lic_mon_ilc]
      ,[lic_capacidad]
      ,[lic_grado_al]
      ,[lic_tipo]
      ,[prec_om]
      ,[rowguid]
      ,[co_us_in]
      ,[fe_us_in]
      ,[co_us_mo]
      ,[fe_us_mo]
      ,[co_uni]
  FROM  [dbo].[v_saConsultaArticulo]
  where anulado =0

    END
```
