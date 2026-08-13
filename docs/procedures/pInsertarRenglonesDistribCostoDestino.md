# SP: pInsertarRenglonesDistribCostoDestino
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarRenglonesDistribCostoDestino
*DESCRIPCIÓN	:	Inserta un renglon de referente a los articulos definidos en una distribucion de costos
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarRenglonesDistribCostoDestino]
    (
         @sDistrib_Num            CHAR(20),
         @iReng_Num               INT, 
         @gRowguid_COMP           UNIQUEIDENTIFIER,
         @sCo_Sucu_In             CHAR(6)                           = NULL ,
        @sCo_Us_In               CHAR(6),
         @sTrasnfe                CHAR(1)                           = NULL ,
         @sRevisado               CHAR(1)                           = NULL ,
         @sMaquina                VARCHAR(60)                       = NULL ,
         @sCo_incoterm            CHAR(6)                           = NULL 
       )
AS
BEGIN
       DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

       INSERT INTO dbo.saDistribCostoDestinoReng
           (distrib_num, reng_num, rowguid_comp, co_us_in, co_sucu_in, 
                 fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, co_incoterm)
       OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
           INTO @TableTimestamp
    VALUES
           (@sDistrib_Num ,@iReng_Num, @gRowguid_COMP, @sCo_Us_In, @sCo_Sucu_In,
                    GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_incoterm)

    DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             -- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saDistribCostoDestinoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I',
            @sMaquina = @sMaquina, @sCampos = @sDistrib_Num
             
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
