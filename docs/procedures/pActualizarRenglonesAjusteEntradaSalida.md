# SP: pActualizarRenglonesAjusteEntradaSalida
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesAjuste]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesAjusteEntradaSalida]
    (
      @sAjue_num CHAR(20) ,
      @sAjue_NumOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Tipo CHAR(6) ,
      @sCo_Art CHAR(30) ,
      @sCo_Alma CHAR(6) ,
      @sCo_Uni CHAR(6) ,
      @sSco_Uni CHAR(6) ,
      @sDis_cen VARCHAR(MAX) = NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              sCoArtOri CHAR(30) ,
              sCoArtNew CHAR(30) ,
              sCoAlmaOri CHAR(6) ,
              sCoAlmaNew CHAR(6) ,
              sCoUniOri CHAR(6) ,
              sCoUniNew CHAR(6) ,
              sTotalArtOri DECIMAL(18, 5) ,
              sTotalArtNew DECIMAL(18, 5) ,
              rowguid UNIQUEIDENTIFIER
            )
         
    
        UPDATE
            saAjusteReng
        SET ajue_num = @sAjue_num, reng_num = @iReng_Num, co_tipo = @sCo_Tipo, co_art = @sCo_Art, co_alma = @sCo_Alma,
            dis_cen = @sDis_cen, total_art = @deTotal_Art, stotal_art = @deStotal_Art, cost_unit = @deCost_Unit,
            co_uni = @sCo_Uni, sco_uni = @sSco_Uni, costo_adi1 = @deCosto_Adi1, costo_adi2 = @deCosto_Adi2,
            costo_adi3 = @deCosto_Adi3, lote_asignado = 0, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), trasnfe = @sTrasnfe, revisado = @sRevisado
     OUTPUT  INSERTED.fe_us_in ,
                INSERTED.fe_us_mo ,
                DELETED.co_art ,
                INSERTED.co_art ,
                DELETED.co_alma ,
                INSERTED.co_alma ,
                DELETED.co_uni ,
                INSERTED
```
