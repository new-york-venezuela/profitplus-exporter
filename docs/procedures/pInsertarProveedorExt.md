# SP: pInsertarProveedorExt
**Tipo**: Insertar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pInsertarProveedorExt]
       @gRowguid_prov UNIQUEIDENTIFIER,
       @sTgasto CHAR(2),
       @sTComp CHAR(2),
       @sCampo1 VARCHAR(60) = NULL ,
    @sCampo2 VARCHAR(60) = NULL ,
    @sCampo3 VARCHAR(60) = NULL ,
    @sCampo4 VARCHAR(60) = NULL ,
    @sCampo5 VARCHAR(60) = NULL ,
    @sCampo6 VARCHAR(60) = NULL ,
    @sCampo7 VARCHAR(60) = NULL ,
    @sCampo8 VARCHAR(60) = NULL ,
    @sRevisado CHAR(1) ,
    @sTrasnfe CHAR(1) ,
    @sCo_Us_In CHAR(6) ,
    @sCo_Sucu_In CHAR(6) ,
    @sMaquina VARCHAR(60)
AS
BEGIN 
       DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
       
       IF EXISTS(SELECT rowguid_prov FROM saProveedorExt WHERE rowguid_prov= @gRowguid_prov)
       BEGIN
             DELETE FROM saProveedorExt WHERE rowguid_prov = @gRowguid_prov
       END

       IF (@stgasto IS NOT NULL OR @sTComp IS NOT NULL)
       BEGIN
             INSERT INTO saProveedorExt (rowguid_prov, tgasto, tComp, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
                    fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, transfe)

             OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                           INTO @TableTimestamp

             VALUES(@gRowguid_prov, @sTgasto, @sTComp, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In,
                       @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe)

             DECLARE @dtFe_In DATETIME
             DECLARE @rowGuidOri UNIQUEIDENTIFIER

             SELECT
                    @dtFe_In = fe_us_in, @rowGuidOri = rowguid
             FROM
                    @TableTimestamp

             -- Insertar Pista
             EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
                    @sTablaOri = 'saProveedorExt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
                    @sCampos = @gRowguid_prov
             
             SELECT
                    *
             FROM
                    @TableTimestamp
       END
END
```
