# SP: pActualizarCaja
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarCaja
*DESCRIPCIÓN	: Actualizar Caja
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [pActualizarCaja]
    (
      @sCod_Caja CHAR(6) ,
      @sCod_CajaOri CHAR(6) ,
      @sDescrip VARCHAR(60) ,
      @sdMes_Ini SMALLDATETIME ,
      @sCo_Mone CHAR(6) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @bInactivo BIT ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 


    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saCaja
        SET cod_caja = @sCod_Caja, descrip = @sDescrip, mes_ini = @sdMes_Ini, co_mone = @sCo_Mone, dis_cen = @sDis_Cen,
            inactivo = @bInactivo, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_caja = @sCod_CajaOri
            AND validador = @tsValidador
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saCaja', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sC
```
