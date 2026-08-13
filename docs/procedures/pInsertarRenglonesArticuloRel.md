# SP: pInsertarRenglonesArticuloRel
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtRelacionadoReng`](../tables/saArtRelacionadoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesArticuloRel
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesArticuloRel]
    (
      @sCo_Art CHAR(30) ,
      @iReng_Num INT ,
      @sCod_Relac CHAR(30) = NULL ,
      @deAux01 DECIMAL(18, 5) ,
      @sAux02 VARCHAR(30) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        INSERT  INTO saArtRelacionadoReng
                ( co_art, reng_num, cod_relac, aux01, aux02, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art, @iReng_Num, @sCod_Relac, @deAux01, @sAux02, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtRelacionadoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Art
	
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
